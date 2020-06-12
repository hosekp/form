import React from 'react';

import { FormIdProvider } from './FormIdProvider';

const Form = (props) => {
  const { onSubmit, children, formId } = props;

  return (
    <FormIdProvider formId={formId}>
      <form onSubmit={onSubmit}>{children}</form>
    </FormIdProvider>
  );
};

export default Form;
