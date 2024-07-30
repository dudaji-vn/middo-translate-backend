import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId, PipelineStage, Types } from 'mongoose';
import { CreateOrEditFormDto } from 'src/form/dto/create-or-edit-form.dto';
import { FormResponse } from 'src/form/schemas/form-response.schema';
import { Form } from 'src/form/schemas/form.schema';
import { detectLanguage, translate } from 'src/messages/utils/translate';
import { SearchQueryParamsDto } from 'src/search/dtos';
import { FormField } from './schemas/form-field.schema';
import { SubmitFormDto } from './dto/submit-form.dto';
import { PaginationQueryParamsDto } from 'src/common/dto/pagination-query.dto';
import { SUPPORTED_LANGUAGES } from 'src/configs/language';
import { Space } from 'src/help-desk/schemas/space.schema';
import { DetailFormRequestDto } from './dto/detail-form-request.dto';

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
  async findById(id: string) {
    const form = await this.formModel.findOne({
      _id: id,
      isDeleted: { $ne: true },
    });
    if (!form) {
      throw new BadRequestException(`form ${id} not found`);
    }
    return form;
  }
  async createOrEditForm(
    spaceId: string,
    userId: string,
    payload: CreateOrEditFormDto,
  ) {
    const { formId, name, thankyou, customize, formFields, description } =
      payload;

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
        description,
      });

      const insertData = formFields.map((item, index) => {
        const { _id, ...restData } = item;
        console.log({ _id });
        return {
          form: form._id,
          order: index,
          ...restData,
        };
      });

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

      const formFieldIds = formFields
        .map((item) => item?._id?.toString())
        .filter(Boolean);

      const fieldsByForm = await this.formFieldModel
        .find({
          form: formId,
          _id: { $in: formFieldIds },
        })
        .lean();
      if (fieldsByForm.length !== formFieldIds.length) {
        throw new BadRequestException('Exist invalid field id.');
      }
      await this.formFieldModel.deleteMany({
        _id: { $nin: formFieldIds },
        form: formId,
      });

      const formFieldUpdates = formFields.map((newField, index) => {
        const newFieldWithForm = { ...newField, form: formId, order: index };
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
  async isSubmitForm(formId: string, userId: string) {
    return await this.formResponseModel.exists({
      form: formId,
      user: userId,
    });
  }
  async getDetailForm(payload: DetailFormRequestDto) {
    const { formId, userId, language } = payload;
    const isSubmitForm = userId
      ? await this.isSubmitForm(formId, userId)
      : false;
    const result = await this.formModel
      .findById(formId)
      .populate('formFields')
      .lean();
    if (!result) {
      return null;
    }
    const isFromSupported = SUPPORTED_LANGUAGES.find(
      (lang) => lang.code === language,
    );
    if (!isFromSupported) {
      return {
        isSubmitted: !!isSubmitForm,
        ...result,
      };
    }
    if (result.thankyou && result.thankyou?.title) {
      const title = result.thankyou.title ?? '';
      const subtitle = result.thankyou.subtitle ?? '';
      const sourceLang = await detectLanguage(result.thankyou.title);
      const [titleTranslate, subTitleTranslate] = await Promise.all(
        [title, subtitle].map((item) => translate(item, sourceLang, language)),
      );
      result.thankyou.title = titleTranslate || title;
      result.thankyou.subtitle = subTitleTranslate || subtitle;
    }

    result.formFields = await Promise.all(
      result.formFields.map(async (item) => {
        const sourceLabel = await detectLanguage(item.label);
        const label = await translate(item.label, sourceLabel, language);
        item.options = item.options.filter(
          (option) => option.type && option.value,
        );

        const sourceOptions = item.options
          ? await Promise.all(
              item.options.map((item) => detectLanguage(item.value)),
            )
          : [];

        const sourceOptionsValue = await Promise.all(
          item.options.map((item, index) =>
            translate(item.value, sourceOptions[index], language),
          ),
        );

        const options = item.options
          ? item.options.map((item, index) => {
              return {
                type: item.type,
                value: sourceOptionsValue[index],
                media: item.media,
              };
            })
          : [];

        return {
          ...item,
          label: label || item.label,
          options: options || item.options,
        };
      }),
    );

    return {
      isSubmitted: !!isSubmitForm,
      ...result,
    };
  }

  async submitForm(formId: string, userId: string, payload: SubmitFormDto) {
    const isSubmitForm = await this.isSubmitForm(formId, userId);
    if (isSubmitForm) {
      throw new BadRequestException('User has submitted form');
    }
    const form = await this.formModel
      .findById(formId)
      .populate('formFields')
      .lean();

    if (!form) {
      throw new BadRequestException('Form not found');
    }

    const answer = Object.keys(payload.answer).map((key) => {
      const field = form.formFields.find((item) => item.name === key);
      if (!field) {
        throw new BadRequestException(
          `'${key}' does not exist in the names of the form fields.`,
        );
      }
      return {
        field: field._id,
        value: payload.answer[key],
      };
    });

    await this.formResponseModel.create({
      form: form,
      user: userId,
      space: form.space,
      answers: answer,
    });

    return true;
  }

  async getFormsBy(
    spaceId: string,
    searchQuery: SearchQueryParamsDto,
    listUsingFormIds: string[],
  ) {
    const { q, limit = 10, currentPage = 1 } = searchQuery;
    const maxItems = 3;

    const query = [
      {
        $match: {
          name: { $regex: q, $options: 'i' },
          isDeleted: { $ne: true },
          space: new Types.ObjectId(spaceId),
        },
      },
      {
        $lookup: {
          from: 'formresponses',
          localField: '_id',
          foreignField: 'form',
          as: 'submissions',
        },
      },
      {
        $lookup: {
          from: 'formfields',
          localField: '_id',
          foreignField: 'form',
          as: 'formFields',
        },
      },
      {
        $lookup: {
          from: 'users',
          let: { submissions: '$submissions' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: [
                    '$_id',
                    {
                      $map: {
                        input: '$$submissions',
                        as: 'submission',
                        in: '$$submission.user',
                      },
                    },
                  ],
                },
              },
            },
            {
              $project: {
                name: 1,
                phoneNumber: 1,
                tempEmail: 1,
              },
            },
          ],
          as: 'users',
        },
      },
      {
        $addFields: {
          totalSubmissions: { $size: '$submissions' },
          submissions: { $slice: ['$submissions', maxItems] },
        },
      },
      {
        $addFields: {
          submissions: {
            $map: {
              input: '$submissions',
              as: 'submission',
              in: {
                $mergeObjects: [
                  '$$submission',
                  {
                    user: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: '$users',
                            as: 'user',
                            cond: { $eq: ['$$user._id', '$$submission.user'] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
      {
        $project: {
          users: 0,
          customize: 0,
          thankyou: 0,
          createdBy: 0,
          lastEditedBy: 0,
          space: 0,
          submissions: {
            user: {
              _id: 0,
            },
          },
        },
      },
    ];

    const totalItemsPromise = this.formModel.aggregate([
      ...query,
      { $count: 'totalCount' },
    ]);

    const queryCurrentData = [
      {
        $sort: {
          createdAt: -1,
        },
      } as PipelineStage,
      {
        $skip: (currentPage - 1) * limit,
      },
      {
        $limit: limit,
      },
    ];

    const dataPromise = this.formModel.aggregate([
      ...query,
      ...queryCurrentData,
    ]);

    const [totalItems, data] = await Promise.all([
      totalItemsPromise,
      dataPromise,
    ]);

    const responseData = data.map((item) => {
      const submissions = item.submissions.map((submitItem: any) => {
        submitItem.answers = submitItem?.answers
          ?.map((answer: any) => {
            const name = item?.formFields.find(
              (field: any) =>
                field?._id?.toString() === answer?.field?.toString(),
            )?.name;

            return {
              name: name,
              value: answer.value,
            };
          })
          .filter((item: any) => item.name);
        const answer = submitItem.answers.reduce((acc: any, item: any) => {
          acc[item?.name] = item.value;
          return acc;
        }, {});

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { answers, space, form, ...restSubItem } = submitItem;

        return {
          ...restSubItem,
          answer,
        };
      });

      return {
        ...item,
        isUsing: listUsingFormIds.includes(item._id.toString()),
        submissions,
      };
    });

    const totalPage = totalItems[0]?.totalCount || 0;
    return {
      totalPage: Math.ceil(totalPage / limit),
      items: responseData,
    };
  }

  async getSubmissionByFormId(
    formId: string,
    paginationQuery: PaginationQueryParamsDto,
    listUsingFormIds: string[],
  ) {
    const { limit = 100, currentPage = 1 } = paginationQuery;
    const form = await this.formModel
      .findOne({
        _id: formId,
        isDeleted: { $ne: true },
      })
      .populate('formFields')
      .select('name formFields createdAt')
      .lean();

    if (!form) {
      throw new BadRequestException('Form not found');
    }

    const totalItemsPromise = await this.formResponseModel.countDocuments({
      form: formId,
    });

    const dataPromise = await this.formResponseModel
      .find({ form: formId })
      .sort({ _id: -1 })
      .skip((currentPage - 1) * limit)
      .limit(limit)
      .populate('user', '-_id name tempEmail phoneNumber')
      .populate({ path: 'answers.field', select: 'name' })
      .lean();

    const [totalItems, data] = await Promise.all([
      totalItemsPromise,
      dataPromise,
    ]);

    const responseData = data.map((submitItem) => {
      const answer = submitItem.answers
        .filter((item) => item?.field?.name)
        .reduce((acc: any, item: any) => {
          acc[item?.field?.name] = item.value;
          return acc;
        }, {});

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { answers, space, form, ...restSubItem } = submitItem;

      return {
        ...restSubItem,
        answer,
      };
    });

    return {
      totalPage: Math.ceil(totalItems / limit),
      ...form,
      isUsing: listUsingFormIds.includes(form._id.toString()),
      totalSubmissions: totalItems,
      submissions: responseData,
    };
  }

  async deleteForm(formId: string, userId: string) {
    const form = await this.formModel
      .findOne({
        _id: formId,
        isDeleted: { $ne: true },
      })
      .populate('space');
    if (!form || !form?.space) {
      throw new BadRequestException('Form not found');
    }
    const space = form.space as Space;
    if (space?.owner?.toString() !== userId) {
      throw new ForbiddenException('You do not have permission to delete form');
    }
    form.isDeleted = true;
    await form.save();
    return true;
  }

  async deleteForms(formIds: string[]) {
    await this.formModel.updateMany({ _id: formIds }, { isDeleted: true });
    return null;
  }
  async getFormsNames(spaceId: string) {
    return await this.formModel
      .find({
        space: spaceId,
        isDeleted: { $ne: true },
      })
      .select('name');
  }

  async getListFormSubmittedByUserAndSpace(
    userId: string | ObjectId,
    spaceId: string | ObjectId,
  ) {
    const response = await this.formResponseModel
      .find({
        space: spaceId,
        user: userId,
      })
      .distinct('form');
    return response.map((item) => item.toString());
  }
}
