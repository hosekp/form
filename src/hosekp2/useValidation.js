import { useRecoilValue } from 'recoil';

import { $fieldValidation, $formValidation } from './selectors';

export const useValidations = (formId) => {
  const validationPairs = useRecoilValue($formValidation(formId));
  return validationPairs.filter(([, error]) => !!error);
};

export const useValidation = (formId, fieldName) => {
  return useRecoilValue($fieldValidation(`${formId}_${fieldName}`));
};
