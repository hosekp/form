import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Form, Input } from 'antd';
import useSafeEffect from 'use-safe-effect-hook';
import { delay } from './utils';

function Configurator({
  name: configuratorName,
  form,
  // initialValue,
  value: superValues,
  onChange,
  setOnReady,
  outerFormId,
}) {
  const [inputs, setInputs] = useState([]);
  const loading = useRef(true);

  // useEffect(()=>{
  //   form.setFieldsValue(superValues);
  // },[form,superValues]);

  /*const onSubmit = useCallback(
    async (bag) => {
      const { values, validation } = bag;
      console.log("submit config", bag, loading.current);
      const possiblyNotReadyYet = loading.current
        ? { [name]: "not ready yet" }
        : {};
      const possiblyError =
        Object.keys(validation).length === 0
          ? {}
          : {
            [name]: `Fields ${Object.keys(validation).join(
              ", "
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
  );*/

  // const { formId, submit, handleSubmit, setValues } = useForm({
  //   initialValues: initialValue,
  //   onSubmit,
  // });

  // const setDelayedSubmit = useCallbackInNextRender();

  const fetchData = (safetyGuard, values = {}) => {
    loading.current = true;
    // propagateErrorToOuterForm({ [name]: "not ready yet" });
    return delay(3000)
      .then(() => {
        return [
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
        ];
      })
      .then((inputs) => {
        setInputs(inputs);
      })
      .then(() => {
        loading.current = false;
      });
  };

  const onChangeCb = useCallback((values) => {
    console.log('onChangeCb', values);
  }, []);

  // const onChangeCb = useRecoilCallback(
  //   async ({ getPromise }, safetyGuard, { name, value }) => {
  //     const input = inputs.find((input) => input.name === name);
  //     const isAutoRefreshDisabled =
  //       input.parameterConfig && input.parameterConfig.noRefresh === true;
  //
  //     if (isAutoRefreshDisabled) submit();
  //     else fetchData(safetyGuard, await getPromise($values(formId)));
  //   },
  //   [formId, submit, inputs]
  // );

  // const requiredRule = useCallback((value) => (value ? null : "required"), []);
  useSafeEffect((safetyGuard) => {
    fetchData(safetyGuard, superValues);
    // propagateErrorToOuterForm({ [name]: "not ready yet" });
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
    <Form.List name={configuratorName + 'List'}>
      {(inputtttt) => {
        console.log('inputtttt', inputtttt);
        return (
          <div>
            {inputs.map(({ name, label }) => (
              <Form.Item
                name={configuratorName + '.' + name}
                label={label}
                rules={[{ required: true, message: `Please input ${label}!` }]}
              >
                <Input />
              </Form.Item>
            ))}
            {loading.current && (
              <Form.Item
                key="notYetReady"
                rules={[
                  { validator: () => new Promise.reject('Not ready yet') },
                ]}
              >
                <span>Not ready yet</span>
              </Form.Item>
            )}
          </div>
        );
      }}
    </Form.List>
    // <form onSubmit={handleSubmit}>
    /*inputs.map(({ name, label }) => (
      <FieldMemo
        key={name}
        as={Input}
        name={name}
        onChange={onChangeCb}
        required
        validator={requiredRule}
        label={label}
      />
    ))*/
    // </form>
  );
}

export default Configurator;
