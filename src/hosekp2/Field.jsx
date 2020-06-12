import React, { memo, Suspense, useContext } from 'react';

import FormContext from './context';
import { useField } from './useField';
import { useValidation } from './useValidation';

function Validation({ name }) {
  const formIdFromContext = useContext(FormContext);
  const [, error] = useValidation(formIdFromContext, name);
  return error ? <span style={{ color: 'red' }}>{error}</span> : null;
}

function FieldInner({
  name,
  label,
  as: Component,
  initialValue,
  required,
  validator,
  onChange,
  onBlur,
  ...other
}) {
  const field = useField({
    name,
    initialValue,
    required,
    validator,
    onChange,
  });

  return (
    <div
      style={
        field.touched && field.invalid ? { border: '1px solid red' } : undefined
      }
    >
      {label && (
        <div>
          <label>
            {label}
            {required ? <span style={{ color: 'red' }}>*</span> : null}
          </label>
        </div>
      )}
      <Component {...other} {...field} />
      {field.touched && (
        <Suspense fallback="validating">
          <Validation name={name} />
        </Suspense>
      )}
    </div>
  );
}

const Field = memo(FieldInner);
export default Field;
