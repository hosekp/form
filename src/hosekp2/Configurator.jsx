import React, { useCallback, useContext, useRef, useState } from 'react';
import { useRecoilCallback } from 'recoil';
import useSafeEffect from 'use-safe-effect-hook';

import { $values } from './selectors';
import Field from './Field';
import { useForm } from './useForm';
import { useCallbackInNextRender } from './useOtherHooks';
import { Input } from './Inputs';
import api from './api';
import { FormIdProvider } from './FormIdProvider';
import FormContext from './context';

function Configurator({ name, initialValue, onChange }) {
  const [inputs, setInputs] = useState([]);
  const loading = useRef(true);
  const parentFormId = useContext(FormContext);

  const onSubmit = useCallback(
    async (bag) => {
      const { values, validation } = bag;
      console.log('submit config', bag, loading.current);
      const possiblyNotReadyYet = loading.current
        ? { [name]: 'not ready yet' }
        : {};
      const possiblyError =
        Object.keys(validation).length === 0
          ? {}
          : {
              [name]: `Fields ${Object.keys(validation).join(
                ', '
              )} is missing.`,
            };
      // TODO passing error here is workaround for https://github.com/facebookexperimental/Recoil/issues/279
      onChange({
        name,
        value: values,
        error: { ...possiblyNotReadyYet, ...possiblyError }[name],
      });
      // propagateErrorToOuterForm({ ...possiblyNotReadyYet, ...possiblyError });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [name, onChange]
  );

  const form = useForm({
    initialValues: initialValue,
    onSubmit,
  });
  const { formId, submit, setValues, setErrors } = form;
  const propagateErrorToOuterForm = useCallback(
    (error) => {
      setErrors({ [name]: error }, parentFormId);
    },
    [setErrors, name, parentFormId]
  );

  const setDelayedSubmit = useCallbackInNextRender();
  const setInitialError = useCallbackInNextRender();

  const fetchData = useCallback(
    async (safetyGuard, values = {}) => {
      propagateErrorToOuterForm('not ready yet');
      loading.current = true;
      api
        .post('anything', { values })
        .then(safetyGuard.checkEffectValidity)
        .then((inputs) => {
          setInputs(inputs);
          // values are not from form
          const reducedValues = inputs.reduce((acc, { name, value }) => {
            acc[name] = value;
            return acc;
          }, {});
          // console.log({ values, reducedValues });
          loading.current = false;
          setValues(reducedValues, true);
          // TODO ??? is it ok
          setDelayedSubmit(submit);
          // submit();
        })
        // TODO hack to be able to read values from atoms
        // setValues() -> submit()
        // .then(() => delay(5))
        // .then(() => submit())
        .catch(() => {
          propagateErrorToOuterForm('Error in Configurator API');
          // ignore invalid effect
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [name, submit, setValues, propagateErrorToOuterForm]
  );

  const onChangeCb = useRecoilCallback(
    async ({ getPromise }, safetyGuard, { name, value }) => {
      const input = inputs.find((input) => input.name === name);
      const isAutoRefreshDisabled =
        input.parameterConfig && input.parameterConfig.noRefresh === true;

      if (isAutoRefreshDisabled) submit();
      else fetchData(safetyGuard, await getPromise($values(formId)));
    },
    [formId, submit, inputs]
  );

  const requiredRule = useCallback((value) => (value ? null : 'required'), []);

  useSafeEffect((safetyGuard) => {
    fetchData(safetyGuard, initialValue);
    setInitialError(() => propagateErrorToOuterForm('not ready yet'));
  }, []);

  return (
    <FormIdProvider formId={formId}>
      {inputs.map(({ name, label }) => (
        <Field
          key={name}
          as={Input}
          name={name}
          onChange={onChangeCb}
          required
          validator={requiredRule}
          label={label}
        />
      ))}
    </FormIdProvider>
  );
}

export default Configurator;
