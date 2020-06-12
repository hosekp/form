import React, { useCallback, useRef, useState } from 'react';
import useSafeEffect from 'use-safe-effect-hook';
import { delay } from './utils';

function Configurator({
  name,
  initialValue,
  onChange,
  setOnReady,
  outerFormId,
}) {
  const [inputs, setInputs] = useState([]);
  const loading = useRef(true);

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
    [name, onChange, propagateErrorToOuterForm]
  );

  const { formId, submit, handleSubmit, setValues } = useForm({
    initialValues: initialValue,
    onSubmit,
  });

  // const setDelayedSubmit = useCallbackInNextRender();

  const fetchData = useCallback(
    async (safetyGuard, values = {}) => {
      propagateErrorToOuterForm({ [name]: 'not ready yet' });
      loading.current = true;
      await delay(3000);
      Promise.resolve([
        {
          name: 'firstName',
          value: values.firstName || '',
          parameterConfig: { noRefresh: true },
          label: 'First Name',
        },
        {
          name: 'lastName',
          value: values.lastName || 'Doe',
          label: 'Last Name',
        },
      ])
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
          // ignore invalid effect
        });
    },
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
    propagateErrorToOuterForm({ [name]: 'not ready yet' });
  }, []);

  // TEST
  // const [x, setX] = useState({ a: 0, b: 0 });
  // const [y, setY] = useRecoilState($test("xyz"));

  // const setYCB = useRecoilCallback(({ set }, n) => {
  //   set($test("xyz"), (x) => ({ ...x, c: n }));
  // }, []);

  // useEffect(() => {
  //   setX((x) => ({ ...x, a: 1 }));
  //   setX((x) => ({ ...x, b: 1 }));
  //   setY((x) => ({ ...x, a: 1 }));
  //   setY((x) => ({ ...x, b: 1 }));
  //   setYCB(1);
  // }, []);

  // useEffect(() => {
  //   console.log("xxxxxx", x);
  // }, [x]);

  // useEffect(() => {
  //   console.log("yyyyyy", y);
  // }, [y]);

  return (
    // <form onSubmit={handleSubmit}>
    inputs.map(({ name, label }) => (
      <FieldMemo
        key={name}
        as={Input}
        name={name}
        onChange={onChangeCb}
        required
        validator={requiredRule}
        label={label}
      />
    ))
    // </form>
  );
}

export default Configurator;
