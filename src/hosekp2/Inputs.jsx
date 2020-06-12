import React from 'react';
import { Select as AntSelect, Input as AntInput } from 'antd';

export const nativeOnChangeMapper = ({ name, onChange }) => ({
  target: { value },
}) => onChange({ name, value });
const MyAntSelect = ({ name, onChange, ...rest }) => {
  // console.log(`MyAntSelect ${name} render`);
  return (
    <AntSelect
      {...rest}
      onChange={(value) => onChange({ name, value })}
      name={name}
    />
  );
};
const MyAntInput = ({ name, onChange, ...rest }) => {
  // console.log(`MyAntInput ${name} render`);
  return (
    <AntInput
      {...rest}
      onChange={nativeOnChangeMapper({ name, onChange })}
      name={name}
    />
  );
};
export { MyAntSelect as Select, MyAntInput as Input };
