import { useCallback, useEffect, useRef } from 'react';
import {
  useRecoilCallback,
  useRecoilValueLoadable,
  useSetRecoilState,
} from 'recoil';

import {
  $field,
  $fields,
  $form,
  $formSubmission,
  $formValidation,
} from './selectors';
import { useWarnOnChanged } from './useOtherHooks';

export function useForm({
  formId: formIdProp,
  onSubmit,
  initialValues = {},
  resetOnUnmount = true,
}) {
  const formId = useRef(formIdProp || 'form.' + Math.random()).current;

  useWarnOnChanged('formId', formId);

  const setForm = useSetRecoilState($form(formId));
  const isSubmitting = useRecoilValueLoadable($formSubmission(formId));

  const setValues = useRecoilCallback(
    ({ set }, values, validate) => {
      Object.keys(values).forEach((id) => {
        return set($field(`${formId}_${id}`), (state) => ({
          ...state,
          value: values[id],
          validation: validate ? state.validator(values[id]) : state.validation,
        }));
      });
    },
    [formId]
  );

  const setErrors = useRecoilCallback(
    ({ set }, errors, targetFormId = formId) => {
      Object.keys(errors).forEach((id) => {
        return set($field(`${targetFormId}_${id}`), (state) => ({
          ...state,
          validation: Promise.resolve([id, errors[id]]),
        }));
      });
    },
    [formId]
  );

  const setTouched = useRecoilCallback(
    ({ set }, touched) => {
      Object.keys(touched).forEach((id) =>
        set($field(`${formId}_${id}`), (state) => ({
          ...state,
          touched: touched[id],
        }))
      );
    },
    [formId]
  );

  const reset = useRecoilCallback(
    async ({ reset, getPromise, set }) => {
      const { fieldIds } = await getPromise($form(formId));
      reset($form(formId));
      fieldIds.forEach((id) => set($field(`${formId}_${id}`, () => undefined)));
    },
    [formId]
  );

  const submit = useRecoilCallback(
    async ({ getPromise }) => {
      const fields = await getPromise($fields(formId));
      const validationPairs = await getPromise($formValidation(formId));

      await onSubmit({
        values: fields.reduce((acc, { name, value }) => {
          if (value) acc[name] = value;
          return acc;
        }, {}),
        touched: fields.reduce((acc, { name, touched }) => {
          acc[name] = touched;
          return acc;
        }, {}),
        fieldIds: fields.map(({ name }) => name),
        setValues,
        setErrors,
        setTouched,
        validation: validationPairs.reduce((acc, [name, error]) => {
          if (error) acc[name] = error;
          return acc;
        }, {}),
        reset,
      });
    },
    [formId, onSubmit, setValues, setErrors, setTouched, reset]
  );

  const createSubmitPromise = useCallback(() => {
    const submission = submit();
    setForm((state) => ({ ...state, submission }));
    return submission;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submit]);

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();
      createSubmitPromise();
    },
    [createSubmitPromise]
  );

  useEffect(() => {
    setValues(initialValues);
    return () => {
      resetOnUnmount && reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // TODO fieldIds add, remove, swap, removeAtIndex, addAtIndex

  return {
    formId,
    setValues,
    setErrors,
    isSubmitting: isSubmitting.state === 'loading',
    submit: createSubmitPromise,
    handleSubmit,
    reset,
  };
}

export default useForm;
