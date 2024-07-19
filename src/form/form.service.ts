import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateOrEditFormDto } from 'src/form/dto/create-or-edit-form-dto';
import { FormResponse } from 'src/form/schemas/form-response.schema';
import { Form } from 'src/form/schemas/form.schema';
import { detectLanguage, translate } from 'src/messages/utils/translate';
import { SearchQueryParamsDto } from 'src/search/dtos';
import { FormField } from './schemas/form-field.schema';

@Injectable()
export class FormService {
  constructor(
    @InjectModel(Form.name)
    private formModel: Model<Form>,
    @InjectModel(FormField.name)
    private formFieldModel: Model<FormField>,
    @InjectModel(FormResponse.name)
    private formResponseModel: Model<FormResponse>,
  ) {}
  async createOrEditForm(
    spaceId: string,
    userId: string,
    payload: CreateOrEditFormDto,
  ) {
    const { formId, name, thankyou, customize, formFields } = payload;

    if (!formId) {
      const isExist = await this.formModel.exists({
        name: name,
        space: spaceId,
        isDeleted: { $ne: true },
      });
      if (isExist) {
        throw new BadRequestException(`Form ${name} already exists`);
      }

      const form = await this.formModel.create({
        space: spaceId,
        lastEditedBy: userId,
        createdBy: userId,
        name,
        thankyou,
        customize,
      });

      const insertData = formFields.map((item) => ({
        form: form._id,
        ...item,
      }));

      const data = await this.formFieldModel.insertMany(insertData);

      await this.formModel.findByIdAndUpdate(form._id, {
        formFields: data.map((item) => item._id),
      });
    } else {
      const form = await this.formModel.findOne({
        _id: formId,
        isDeleted: { $ne: true },
      });
      if (!form) {
        throw new BadRequestException('Form not found');
      }

      const formIds = formFields
        .map((item) => item?._id?.toString())
        .filter(Boolean);

      await this.formFieldModel.deleteMany({
        _id: { $nin: formIds },
        form: formId,
      });

      const formFieldUpdates = formFields.map((newField) => {
        const newFieldWithForm = { ...newField, form: formId };
        if (newField._id) {
          return this.formFieldModel.findByIdAndUpdate(
            newField._id,
            newFieldWithForm,
            {
              new: true,
              upsert: true,
            },
          );
        } else {
          return this.formFieldModel.create(newFieldWithForm);
        }
      });

      const updatedFields = await Promise.all(formFieldUpdates);

      await this.formModel.findByIdAndUpdate(formId, {
        ...payload,
        lastEditedBy: userId,
        ...(updatedFields.length > 0 && {
          formFields: updatedFields.map((field) => field?._id),
        }),
      });
    }

    return true;
  }

  async getDetailForm(formId: string, language: string) {
    const result = await this.formModel
      .findById(formId)
      .populate('formFields')
      .lean();
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
    const form = await this.formModel.findById(formId);

    if (!form) {
      throw new BadRequestException('Form not found');
    }

    return true;
  }

  async getFormsBy(
    spaceId: string,
    searchQuery: SearchQueryParamsDto,
    userId: string,
  ) {
    const query = [
      {
        $lookup: {
          from: 'forms',
          localField: 'form',
          foreignField: '_id',
          as: 'formDetails',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDetails',
        },
      },

      {
        $unwind: '$formDetails',
      },
      {
        $unwind: '$userDetails',
      },
      {
        $unwind: {
          path: '$answers',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'formfields',
          localField: 'answers.field',
          foreignField: '_id',
          as: 'answers.fieldDetails',
        },
      },
      {
        $unwind: {
          path: '$answers.fieldDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: '$form',
          form: { $first: '$formDetails.name' },
          results: {
            $push: {
              user: {
                _id: '$userDetails._id',
                name: '$userDetails.name',
              },
              field: {
                name: '$answers.fieldDetails.name',
              },
              value: '$answers.value',
            },
          },
        },
      },
    ];
    return await this.formResponseModel.aggregate(query);
  }
}
