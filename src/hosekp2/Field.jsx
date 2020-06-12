import React, { memo, Suspense, useContext } from 'react';
import { useRecoilValue } from 'recoil';

import FormContext from './context';
import { $fieldValidation } from './selectors';
import { useField } from './useField';

function Validation({ name }) {
  const formIdFromContext = useContext(FormContext);
  const [, error] = useRecoilValue(
    $fieldValidation(`${formIdFromContext}_${name}`)
  );
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
