import { useCallback, useContext, useEffect } from 'react';
import {
  useRecoilCallback,
  useRecoilState,
  useRecoilValueLoadable,
  useSetRecoilState,
} from 'recoil';

import FormContext from './context';
import {
  $field,
  $fieldValidation,
  $form,
  $touched,
  $values,
} from './selectors';
import { useCallbackInNextRender, useWarnOnChanged } from './useOtherHooks';

const emptyValidator = (value) => null;

function useValidationResult({ name, formId }) {
  const result = useRecoilValueLoadable($fieldValidation(`${formId}_${name}`));
  return result.state === 'hasValue' && result.contents[1] !== null;
}

export function useField({
  name,
  initialValue,
  required,
  validator = emptyValidator,
  onChange: onChangeCb,
}) {
  const formId = useContext(FormContext);

  useWarnOnChanged('formId', formId);
  useWarnOnChanged('name', formId);

  const setFormState = useSetRecoilState($form(formId));
  const [fieldState, setFieldState] = useRecoilState(
    $field(`${formId}_${name}`)
  );
  const invalid = useValidationResult({ name, formId });

  const getBag = useRecoilCallback(
    async ({ getPromise }) => {
      const [values, touched] = await Promise.all(
        getPromise($values(formId)),
        getPromise($touched(formId))
      );
      delete values[name];
      delete touched[name];
      return { values, touched };
    },
    [] // name and formId can not be changed
  );

  const onBlur = useCallback(() => {
    setFieldState((state) => ({ ...state, touched: true }));
  }, [setFieldState]);

  const delayOnChange = useCallbackInNextRender();

  const onChange = useCallback(
    ({ name, value, error, touched = true }) => {
      setFieldState((state) => ({
        ...state,
        touched,
        value,
        validation: error
          ? Promise.resolve([state.name, error])
          : state.validator(value, getBag),
      }));
      onChangeCb && delayOnChange(onChangeCb, { name, value });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChangeCb, getBag]
  );

  useEffect(() => {
    setFormState((state) => ({
      ...state,
      fieldIds: [...state.fieldIds, name],
    }));
    return () => {
      // TODO reset
      setFieldState(() => undefined);
      setFormState((state) => ({
        ...state,
        fieldIds: state.fieldIds.filter((id) => id === name),
      }));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setFieldState((state) => ({
      ...state,
      value: state.value || initialValue,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setFieldState((state) => {
      const wrappedValidator = async (value) => [
        state.name,
        await validator(value, getBag),
      ];
      return {
        ...state,
        required, // TODO
        validator: wrappedValidator,
        validation: wrappedValidator(state.value),
      };
    });
  }, [required, validator]);

  return { ...fieldState, initialValue, formId, invalid, onBlur, onChange };
}
