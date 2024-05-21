import * as moment from 'moment';
import {
  AnalystFilterDto,
  AnalystType,
} from 'src/help-desk/dto/analyst-query-dto';
import { AnalystResponseDto } from 'src/help-desk/dto/analyst-response-dto';
export function addMissingDates(
  data: AnalystResponseDto[],
  fromDate: Date,
  toDate: Date,
): AnalystResponseDto[] {
  // Convert existing dates to a Map for easy lookup
  const existingDates = new Map<string, AnalystResponseDto>();
  data.forEach((entry) => {
    existingDates.set(entry.date, entry);
  });

  // Get the start and end dates from the existing data
  const startDate = fromDate;
  const endDate = toDate;

  // Generate dates for the entire week
  const currentDate = new Date(startDate);
  const allDates: string[] = [];
  while (currentDate <= endDate) {
    const dateString = `${currentDate.getDate()}-${
      currentDate.getMonth() + 1
    }-${currentDate.getFullYear()}`;
    allDates.push(dateString);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Add missing dates with count 0
  const newData: AnalystResponseDto[] = allDates.map((date) => {
    if (existingDates.has(date)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return existingDates.get(date)!;
    } else {
      const [day, month, year] = date.split('-').map(Number);
      return {
        date,
        day,
        month,
        year,
        count: 0,
      };
    }
  });

  return newData;
}

export function addMissingMonths(data: AnalystResponseDto[]) {
  // Get the current month and year
  const currentDate: Date = new Date();
  const currentMonth: number = currentDate.getMonth();
  const currentYear: number = currentDate.getFullYear();

  // Calculate the start month and year
  let startMonth: number = (currentMonth + 1) % 12; // Last month of last year
  const startYear: number = currentYear - 1;
  if (startMonth === 0) {
    startMonth = 12;
  }

  // Create a list of months from the start month and year to the current month and year
  const months = [];
  for (let year = startYear; year <= currentYear; year++) {
    for (
      let month = year === startYear ? startMonth : 1;
      month <= (year === currentYear ? currentMonth + 1 : 12);
      month++
    ) {
      months.push({ count: 0, month, year });
    }
  }

  // Iterate through each month and add it to the data if it doesn't exist
  months.forEach(({ month, year }) => {
    const monthExists: boolean = data.some(
      (item) => item.month === month && item.year === year,
    );
    if (!monthExists) {
      data.push({
        count: 0,
        month,
        year,
        date: '',
        day: 1,
      });
    }
  });

  // Sort the data by year and month
  data.sort((a, b) => {
    if (a.year === b.year) {
      return a.month - b.month;
    }
    return a.year - b.year;
  });

  return data;
}

export function pivotChartByType(chart: any, filter: AnalystFilterDto) {
  const { fromDate, toDate, type } = filter;
  if (!fromDate || !toDate) {
    return [];
  }
  switch (type) {
    case AnalystType.LAST_WEEK:
      chart = addMissingDates(chart, fromDate, toDate).map((item) => {
        return {
          label: moment(item.date, 'DD/MM/YYYY').format('dddd'),
          value: item.count,
        };
      });

      break;

    case AnalystType.LAST_MONTH:
      chart = addMissingDates(chart, fromDate, toDate).map((item) => {
        return {
          label: item.date,
          value: item.count,
        };
      });

      break;
    case AnalystType.LAST_YEAR:
      chart = addMissingMonths(chart).map((item) => {
        return {
          label: `01-${item.month}-${item.year}`,
          value: item.count,
        };
      });

      break;

    case AnalystType.CUSTOM:
      chart = chart.map((item: any) => {
        return {
          label: item.date,
          value: item.count,
        };
      });

      break;
  }
  return chart;
}
