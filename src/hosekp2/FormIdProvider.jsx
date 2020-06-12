import React from 'react';

import FormContext from './context';

export function FormIdProvider({ formId, children }) {
  return <FormContext.Provider value={formId}>{children}</FormContext.Provider>;
}
