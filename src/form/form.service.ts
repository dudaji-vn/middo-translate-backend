import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { CreateOrEditFormDto } from 'src/form/dto/create-or-edit-form.dto';
import { FormResponse } from 'src/form/schemas/form-response.schema';
import { Form } from 'src/form/schemas/form.schema';
import { detectLanguage, translate } from 'src/messages/utils/translate';
import { SearchQueryParamsDto } from 'src/search/dtos';
import { FormField } from './schemas/form-field.schema';
import { SubmitFormDto } from './dto/submit-form.dto';

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
      // const isExist = await this.formModel.exists({
      //   name: name,
      //   space: spaceId,
      //   isDeleted: { $ne: true },
      // });
      // if (isExist) {
      //   throw new BadRequestException(`Form ${name} already exists`);
      // }

      const form = await this.formModel.create({
        space: spaceId,
        lastEditedBy: userId,
        createdBy: userId,
        name,
        thankyou,
        customize,
      });

      const insertData = formFields.map((item, index) => ({
        form: form._id,
        order: index,
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

    // result.formFields = await Promise.all(
    //   result.formFields.map(async (item) => {
    //     const sourceLabel = await detectLanguage(item.label);
    //     const label = await translate(item.label, sourceLabel, language);

    //     const sourceOptions = item.options
    //       ? await Promise.all(
    //           item.options.map((item) => detectLanguage(item.value)),
    //         )
    //       : [];

    //     const options = item.options
    //       ? await Promise.all(
    //           item.options.map((item, index) =>
    //             translate(item.value, sourceOptions[index], language),
    //           ),
    //         )
    //       : [];

    //     return {
    //       ...item,
    //       translations: {
    //         label: {
    //           [language]: label || item.label,
    //         },
    //         options: {
    //           [language]: options || item.options,
    //         },
    //       },
    //     };
    //   }),
    // );

    return result;
  }

  async submitForm(formId: string, userId: string, payload: SubmitFormDto) {
    const form = await this.formModel.findById(formId);
    if (!form) {
      throw new BadRequestException('Form not found');
    }

    await this.formResponseModel.create({
      form: form,
      user: userId,
      space: form.space,
      answers: payload.answers.map((item) => ({
        field: item.fieldId,
        value: item.value,
      })),
    });

    return true;
  }

  async getFormsBy(
    spaceId: string,
    searchQuery: SearchQueryParamsDto,
    listUsingFormIds: string[],
  ) {
    const { q, limit = 100, currentPage = 1 } = searchQuery;
    const maxItems = 3;

    const query = [
      {
        $match: {
          name: { $regex: q, $options: 'i' },
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

        return {
          ...submitItem,
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
}
