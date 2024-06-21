import { PipelineStage, Types } from 'mongoose';
import {
  AnalystFilterDto,
  AnalystType,
} from 'src/help-desk/dto/analyst-query-dto';
import { SenderType } from 'src/messages/schemas/messages.schema';
import { RoomStatus } from 'src/rooms/schemas/room.schema';
import { UserStatus } from 'src/users/schemas/user.schema';

export function queryReportByType(
  type: AnalystType = AnalystType.LAST_WEEK,
  pipeline?: any,
  timeType?: '$createdAt' | '$updatedAt' | '$expiredAt' | '$trackings',
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

export function queryDropRate(
  filter: AnalystFilterDto,
  pipeline?: any,
): PipelineStage[] {
  const { spaceId, fromDate, toDate, fromDomain } = filter;
  const stages = [
    {
      $match: {
        status: RoomStatus.ACTIVE,
        space: new Types.ObjectId(spaceId),
        ...(fromDomain && {
          fromDomain: fromDomain,
        }),
        ...(fromDate &&
          toDate && {
            expiredAt: {
              $gte: fromDate,
              $lte: toDate,
            },
          }),
      },
    },
    {
      $lookup: {
        from: 'messages',
        localField: 'lastMessage',
        foreignField: '_id',
        as: 'lastMessage',
      },
    },
    {
      $addFields: {
        lastMessage: { $arrayElemAt: ['$lastMessage', 0] },
      },
    },
    {
      $match: {
        $or: [
          {
            'lastMessage.action': 'leaveHelpDesk',
          },
          {
            expiredAt: { $lte: new Date() },
          },
        ],
      },
    },
  ];
  if (pipeline) {
    stages.push(...pipeline);
  }
  return stages;
}

export function queryVisitor(filter: AnalystFilterDto) {
  const { spaceId, fromDate, toDate, fromDomain } = filter;
  return [
    {
      $match: {
        space: new Types.ObjectId(spaceId),
        ...(fromDomain && {
          fromDomain: fromDomain,
        }),
      },
    },
    {
      $unwind: {
        path: '$trackings',
      },
    },
    {
      $match: {
        ...(fromDate &&
          toDate && {
            trackings: {
              $gte: fromDate,
              $lte: toDate,
            },
          }),
      },
    },
  ];
}

export function queryOpenedConversation(filter: AnalystFilterDto) {
  const { spaceId, fromDate, toDate, fromDomain } = filter;
  return [
    {
      $match: {
        space: new Types.ObjectId(spaceId),
        ...(fromDomain && {
          fromDomain: fromDomain,
        }),
        ...(fromDate &&
          toDate && {
            createdAt: {
              $gte: fromDate,
              $lte: toDate,
            },
          }),
      },
    },
  ];
}

export function queryResponseTime(filter: AnalystFilterDto) {
  const { spaceId, fromDate, toDate, fromDomain, memberId, type } = filter;
  return [
    {
      $match: {
        space: new Types.ObjectId(spaceId),
        isHelpDesk: true,
        ...(fromDomain && {
          fromDomain: fromDomain,
        }),
        ...(fromDate &&
          toDate && {
            createdAt: {
              $gte: fromDate,
              $lte: toDate,
            },
            newMessageAt: {
              $gte: fromDate,
              $lte: toDate,
            },
          }),
      },
    },
    {
      $lookup: {
        from: 'messages',
        let: { roomId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$room', '$$roomId'] },
                  { $eq: ['$senderType', SenderType.USER] },
                  ...(memberId
                    ? [{ $eq: ['$sender', new Types.ObjectId(memberId)] }]
                    : []),
                ],
              },
            },
          },
        ],
        as: 'messages',
      },
    },
    {
      $match: {
        'messages.0': { $exists: true },
      },
    },
    {
      $addFields: {
        secondMessage: { $arrayElemAt: ['$messages', 0] },
      },
    },
    {
      $project: {
        day: {
          $dayOfMonth: '$createdAt',
        },
        month: {
          $month: '$createdAt',
        },
        year: {
          $year: '$createdAt',
        },
        timeDifference: {
          $subtract: ['$secondMessage.createdAt', '$createdAt'],
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
        averageDifference: { $avg: '$timeDifference' },
      },
    },
  ];
}

export function queryRating(filter: AnalystFilterDto) {
  const { spaceId, fromDate, toDate, fromDomain, memberId } = filter;
  return [
    {
      $match: {
        space: new Types.ObjectId(spaceId),
      },
    },
    {
      $unwind: '$ratings',
    },
    {
      $match: {
        'ratings.createdAt': { $gte: fromDate, $lte: toDate },
      },
    },
    {
      $lookup: {
        from: 'rooms',
        localField: 'ratings.user',
        foreignField: 'participants',
        as: 'room',
      },
    },
    {
      $addFields: {
        room: { $arrayElemAt: ['$room', 0] },
      },
    },
    {
      $match: {
        ...(fromDomain && { fromDomain: fromDomain }),
      },
    },
    {
      $lookup: {
        from: 'messages',
        localField: 'room._id',
        foreignField: 'room',
        as: 'messages',
      },
    },
    {
      $match: {
        ...(memberId && { 'messages.sender': new Types.ObjectId(memberId) }),
      },
    },
  ];
}

export function queryResponseMessage(filter: AnalystFilterDto) {
  const { spaceId, fromDate, toDate, fromDomain, memberId } = filter;
  return [
    {
      $match: {
        space: new Types.ObjectId(spaceId),
        isHelpDesk: true,
        ...(fromDomain && {
          fromDomain: fromDomain,
        }),
        ...(fromDate &&
          toDate && {
            createdAt: {
              $gte: fromDate,
              $lte: toDate,
            },
            newMessageAt: {
              $gte: fromDate,
              $lte: toDate,
            },
          }),
      },
    },
    {
      $lookup: {
        from: 'messages',
        let: { roomId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$room', '$$roomId'] },
                  { $eq: ['$senderType', SenderType.USER] },
                  ...(memberId
                    ? [{ $eq: ['$sender', new Types.ObjectId(memberId)] }]
                    : []),
                ],
              },
            },
          },
        ],
        as: 'messages',
      },
    },

    {
      $match: {
        'messages.0': { $exists: true },
      },
    },
    {
      $project: {
        createdAt: 1,
        total: { $size: '$messages' },
      },
    },
  ];
}

export function queryGroupByLanguage(filter: AnalystFilterDto) {
  const {
    spaceId,
    fromDate,
    toDate,
    fromDomain,
    hour = -1,
    dayOfWeek = -1,
  } = filter;

  return [
    {
      $match: {
        space: new Types.ObjectId(spaceId),
        status: UserStatus.ANONYMOUS,
        ...(fromDate &&
          toDate && {
            createdAt: {
              $gte: fromDate,
              $lte: toDate,
            },
          }),
        ...(hour >= 0 &&
          dayOfWeek >= 0 && {
            $expr: {
              $and: [
                { $eq: [{ $hour: '$createdAt' }, hour] },
                { $eq: [{ $dayOfWeek: '$createdAt' }, dayOfWeek] },
              ],
            },
          }),
      },
    },
    {
      $lookup: {
        from: 'rooms',
        let: { userId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $in: ['$$userId', '$participants'] },
                  {
                    $eq: ['$space', new Types.ObjectId(spaceId)],
                  },
                ],
              },
            },
          },
        ],
        as: 'room',
      },
    },
    {
      $match: {
        'room.0': { $exists: true },
        ...(fromDomain && {
          'room.fromDomain': fromDomain,
        }),
      },
    },
    {
      $group: {
        _id: '$language',
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        language: '$_id',
        count: 1,
      },
    },
  ];
}
