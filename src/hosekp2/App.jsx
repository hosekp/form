import React, { useCallback, useMemo, Suspense, useContext } from 'react';
import {
  RecoilRoot,
  // atomFamily,
  useRecoilValue,
} from 'recoil';

import FormContext from './context';
import { $formValidation } from './selectors';
import { delay } from './utils';
import { useForm } from './useForm';
import Field from './Field';
import Configurator from './Configurator';
import { Input, Select } from './Inputs';

import 'antd/dist/antd.css';
import Form from './Form';

const selectOptions = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
  { value: 'c', label: 'C' },
];

export function FormValidation() {
  const formId = useContext(FormContext);
  const validationPairs = useRecoilValue($formValidation(formId));
  return (
    <div>
      {validationPairs
        .filter(([, error]) => !!error)
        .map(([name, error]) => (
          <div>
            {name}: {error}
          </div>
        ))}
    </div>
  );
}

function SomeForm() {
  const onSubmit = useCallback(async (bag) => {
    console.log('onSubmit', bag);
    bag.setValues({ variant: 'c' });
    bag.setErrors({ y: 'fuck!' });
    await delay(2000);
  }, []);

  const form = useForm({
    formId: 'AppForm',
    onSubmit,
  });
  const { isSubmitting, handleSubmit } = form;

  const validator = useCallback(async (value) => {
    await delay(1000);
    return value === 'foo' ? 'bar' : null;
  }, []);

  const configInitialValue = useMemo(() => ({ firstName: 'John' }), []);

  return (
    <>
      <Form onSubmit={handleSubmit} formId={form.formId}>
        <Field
          as={Select}
          name="variant"
          options={selectOptions}
          initialValue="b"
          label="variant"
        />
        <Field
          as={Select}
          options={selectOptions}
          name="x"
          initialValue="b"
          label="method"
        />
        <Field
          as={Input}
          name="y"
          initialValue=""
          required
          validator={validator}
          label="name"
        />
        <Field
          as={Configurator}
          name="config"
          initialValue={configInitialValue}
        />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'submitting' : 'submit'}
        </button>
        <Suspense fallback="validating form">
          <FormValidation />
        </Suspense>
      </Form>
    </>
  );
}

function App() {
  return (
    <RecoilRoot>
      <div className="App">
        <SomeForm />
      </div>
    </RecoilRoot>
  );
}

export default App;
