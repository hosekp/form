import { atomFamily, selectorFamily, waitForAll } from 'recoil';

export const $form = atomFamily({
  key: `form`,
  default: (id) => ({ id, fieldIds: [], submission: Promise.resolve(null) }),
});

export const $formSubmission = selectorFamily({
  key: 'form_submission',
  get: (id) => ({ get }) => get($form(id)).submission,
});

export const $field = atomFamily({
  key: 'form_field',
  default: (id) => {
    const [formId, name] = id.split('_');
    const validationResult = Promise.resolve([name, null]);
    return {
      id,
      formId,
      name,
      value: undefined,
      touched: false,
      required: false, // TODO
      validation: validationResult,
      validator: (value) => validationResult,
    };
  },
});

export const $fieldValidation = selectorFamily({
  key: 'form_field_validation',
  get: (id) => ({ get }) => get($field(id)).validation,
});

export const $formValidation = selectorFamily({
  key: 'form_validation',
  get: (formId) => ({ get }) => {
    const { fieldIds } = get($form(formId));
    return waitForAll(
      fieldIds.map((id) => $fieldValidation(`${formId}_${id}`))
    );
  },
});

export const $fields = selectorFamily({
  key: 'form_fields',
  get: (formId) => ({ get }) => {
    const { fieldIds } = get($form(formId));
    return fieldIds.map((id) => get($field(`${formId}_${id}`)));
  },
});

export const $values = selectorFamily({
  key: 'form_values',
  get: (formId) => ({ get }) => {
    return get($fields(formId)).reduce((acc, { name, value }) => {
      if (value) acc[name] = value;
      return acc;
    }, {});
  },
});

export const $touched = selectorFamily({
  key: 'form_touched',
  get: (formId) => ({ get }) => {
    return get($fields(formId)).reduce((acc, { name, touched }) => {
      acc[name] = touched;
      return acc;
    }, {});
  },
});
