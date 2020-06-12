import React, { Suspense, useCallback, useContext, useMemo } from 'react';

import { delay } from './utils';
import { useForm } from './useForm';
import Form from './Form';
import Field from './Field';
import { Input, Select } from './Inputs';
import Configurator from './Configurator';
import FormContext from './context';
import { useValidations } from './useValidation';

const selectOptions = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
  { value: 'c', label: 'C' },
];

function FormValidation() {
  const formId = useContext(FormContext);
  const validationPairs = useValidations(formId);
  return (
    <div>
      {validationPairs.map(([name, error]) => (
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

export default SomeForm;
