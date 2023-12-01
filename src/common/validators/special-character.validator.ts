import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'specialCharacter', async: false })
export class SpecialCharacterValidator implements ValidatorConstraintInterface {
  validate(text: string) {
    return !/[~`!#$%\^&*+=\-\[\]\\';,/{}|\\":<>\?]/g.test(text);
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} cannot contain special characters`;
  }
}
