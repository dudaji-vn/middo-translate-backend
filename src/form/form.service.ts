import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateOrEditFormDto } from 'src/help-desk/dto/create-or-edit-form-dto';
import { FormResponse } from 'src/common/schemas/form-response.schema';
import { Form } from 'src/common/schemas/form.schema';
import { detectLanguage, translate } from 'src/messages/utils/translate';
import { SearchQueryParamsDto } from 'src/search/dtos';

@Injectable()
export class FormService {
  constructor(
    @InjectModel(Form.name)
    private formModel: Model<Form>,
    @InjectModel(FormResponse.name)
    private formResponseModel: Model<FormResponse>,
  ) {}
  async createOrEditForm(
    spaceId: string,
    userId: string,
    payload: CreateOrEditFormDto,
  ) {
    const { formId, name, color, backgroundColor, images } = payload;

    if (!formId) {
      const isExist = await this.formModel.exists({
        name: name,
        space: spaceId,
        isDeleted: { $ne: true },
      });
      if (isExist) {
        throw new BadRequestException(`Form ${name} is exist`);
      }
      const item: Partial<Form> = {
        ...payload,
        space: spaceId,
        lastEditedBy: userId,
        createdBy: userId,
      };
      await this.formModel.create(item);
    } else {
      const form = await this.formModel.findOne({
        _id: formId,
        isDeleted: { $ne: true },
      });
      if (!form) {
        throw new BadRequestException('Form not found');
      }

      const formIds = payload.formFields.map((item) => item?._id?.toString());

      form.formFields = form.formFields.filter((item) =>
        formIds.includes(item._id.toString()),
      );
      payload.formFields.forEach((newField) => {
        const existingField = form.formFields.find(
          (item) => item._id.toString() === newField?._id?.toString(),
        );
        if (existingField) {
          existingField.label = newField.label || existingField.label;
          existingField.type = newField.type || existingField.type;
          existingField.name = newField.name || existingField.name;
          existingField.options = newField.options || existingField.options;
          existingField.required = newField.required;
          existingField.order = newField.order;
        } else {
          form.formFields.push(newField);
        }
      });

      form.name = name || form.name;
      form.color = color || form.color;
      form.backgroundColor = backgroundColor || form.backgroundColor;
      form.images = images || form.images;
      form.lastEditedBy = userId;
      await form.save();
    }

    return true;
  }
  async getDetailForm(formId: string, language: string) {
    const result = await this.formModel.findById(formId).lean();
    if (!result) {
      return null;
    }

    result.formFields = await Promise.all(
      result.formFields.map(async (item) => {
        const sourceLabel = await detectLanguage(item.label);
        const label = await translate(item.label, sourceLabel, language);

        const sourceOptions = item.options
          ? await Promise.all(item.options.map((item) => detectLanguage(item)))
          : [];

        const options = item.options
          ? await Promise.all(
              item.options.map((item, index) =>
                translate(item, sourceOptions[index], language),
              ),
            )
          : [];

        return {
          ...item,
          translations: {
            label: {
              [language]: label || item.label,
            },
            options: {
              [language]: options || item.options,
            },
          },
        };
      }),
    );

    return result;
  }

  async submitForm(formId: string, userId: string) {
    return true;
  }

  async getFormsBy(
    spaceId: string,
    searchQuery: SearchQueryParamsDto,
    userId: string,
  ) {
    return await this.formResponseModel.find().populate('answers.field');
  }
}
