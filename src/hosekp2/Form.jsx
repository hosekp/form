import React from 'react';

import { FormProvider } from './FormProvider';

const Form = (props) => {
  const { onSubmit, children, form } = props;

  return (
    <FormProvider form={form}>
      <form onSubmit={onSubmit}>{children}</form>
    </FormProvider>
  );
};

export default Form;
