import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function IsArrayUnique(
  property: string,
  validationOptions?: ValidationOptions,
) {
  // eslint-disable-next-line @typescript-eslint/ban-types
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isArrayUnique',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [property],
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (!Array.isArray(value)) {
            return true;
          }
          const [property] = args.constraints;
          const uniqueItems = new Set(value.map((item) => item[property]));
          return uniqueItems.size === value.length;
        },
        defaultMessage(args: ValidationArguments) {
          const [property] = args.constraints;
          return `${property} values should be unique`;
        },
      },
    });
  };
}
