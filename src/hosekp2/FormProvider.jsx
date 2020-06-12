import React from 'react';

import FormContext from './context';

export function FormProvider({ form, children }) {
  return <FormContext.Provider value={form}>{children}</FormContext.Provider>;
}
