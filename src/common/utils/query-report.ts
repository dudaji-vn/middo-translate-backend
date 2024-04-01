import { PipelineStage } from 'mongoose';
import { AnalystType } from 'src/help-desk/dto/analyst-query-dto';

export function queryReportByType(
  type: AnalystType,
  pipeline?: any,
  timeType?: '$createdAt' | '$updatedAt',
): PipelineStage[] {
  return [
    ...pipeline,
    {
      $project: {
        day: {
          $dayOfMonth: timeType ? timeType : '$createdAt',
        },
        month: {
          $month: timeType ? timeType : '$createdAt',
        },
        year: {
          $year: timeType ? timeType : '$createdAt',
        },
      },
    },
    {
      $group: {
        _id: {
          ...(type !== AnalystType.LAST_YEAR && { day: '$day' }),
          year: '$year',
          month: '$month',
        },
        count: {
          $sum: 1,
        },
      },
    },

    {
      $project: {
        _id: 0,
        date: {
          $concat: [
            { $toString: '$_id.day' },
            '-',
            { $toString: '$_id.month' },
            '-',
            { $toString: '$_id.year' },
          ],
        },
        day: '$_id.day',
        month: '$_id.month',
        year: '$_id.year',
        count: '$count',
      },
    },
    {
      $sort: {
        day: 1,
      } as any,
    },
  ];
}
