import React, {
  useRef,
  useState,
  useCallback,
  useReducer,
  useMemo,
  useEffect,
  memo,
} from 'react';
import useSafeEffect from 'use-safe-effect-hook';

const delay = (t) => new Promise((res) => setTimeout(res, t));

export const nativeOnChangeMapper = ({ name, onChange }) => ({
  target: { value },
}) => onChange({ name, value });

const emptyObject = {};

const initialState = {
  values: {},
  errors: {},
  lastTouchedField: { name: undefined },
  lastEditedField: { name: undefined },
  version: { id: 0, validate: true },
  isSubmitting: false,
  isValidating: false,
  validation: null,
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'SET_VALUE': {
      const errorsCopy = { ...state.errors };
      if (action.error) errorsCopy[action.name] = action.error;
      else delete errorsCopy[action.name];

      return {
        ...state,
        values: { ...state.values, [action.name]: action.value },
        errors: errorsCopy,
        // it's wrapped in an object to force useEffect hook
        lastEditedField: { name: action.name },
      };
    }
    case 'SET_LAST_TOUCHED_FIELD':
      return {
        ...state,
        lastTouchedField: { name: action.name },
      };
    case 'REGISTER_FIELD':
      return {
        ...state,
        values: {
          ...state.values,
          [action.name]: state.values[action.name] || action.value,
        },
      };
    case 'UNREGISTER_FIELD': {
      const valuesCopy = { ...state.values };
      const errorsCopy = { ...state.errors };
      delete valuesCopy[action.name];
      delete errorsCopy[action.name];
      return {
        ...state,
        values: { ...valuesCopy },
        errors: { ...errorsCopy },
      };
    }
    case 'SET_VALUES':
      return {
        ...state,
        values: action.values,
        version: { id: state.version.id + 1, validate: action.validate },
      };
    case 'SET_ERRORS':
      return {
        ...state,
        errors: action.errors,
      };
    case 'SET_ERROR':
      return {
        ...state,
        errors: { ...state.errors, [action.name]: action.error },
      };
    case 'SET_IS_SUBMITTING':
      return {
        ...state,
        isSubmitting: action.value,
      };
    case 'SET_IS_VALIDATING':
      return {
        ...state,
        isValidating: action.value,
      };
    case 'RESET':
      return {
        ...initialState,
        values: action.values,
      };
    case 'SET_VALIDATION':
      return {
        ...state,
        validation: action.validation,
      };
    default:
      return state;
  }
};

const init = ({ defaultValues }) => ({
  ...initialState,
  values: defaultValues,
});

const defaultOnValidate = ({ errors }) => errors;

const hasErrors = (errors) => Object.keys(errors).length > 0;

export function useForm({
  defaultValues = emptyObject,
  onSubmit,
  onChange,
  onValidate = defaultOnValidate,
  createValidationResource,
  validateOnMount = true,
  validateOnChange = true,
  validateOnBlur = true,
}) {
  // registered fields
  const touched = useRef({});
  const [state, dispatch] = useReducer(reducer, { defaultValues }, init);

  const isFieldRegistered = (name) => touched.current[name] !== undefined;

  const setValues = useCallback(
    (values, validate) => dispatch({ type: 'SET_VALUES', values, validate }),
    []
  );

  const setErrors = useCallback(
    (errors) => dispatch({ type: 'SET_ERRORS', errors }),
    []
  );

  const runValidation = useCallback(
    ({ checkEffectValidity }, name) => {
      dispatch({ type: 'SET_IS_VALIDATING', value: true });

      const x = {
        name,
        value: state.values[name],
        values: state.values,
        touched: touched.current,
        errors: state.errors,
      };

      console.log('runValidation', state.values);

      const validation = onValidate(x)
        // TODO
        // .then(checkEffectValidity)
        .then((errors) => {
          dispatch({ type: 'SET_ERRORS', errors });
          dispatch({ type: 'SET_IS_VALIDATING', value: false });
          return { ...x, errors };
        });

      dispatch({ type: 'SET_VALIDATION', validation });
    },
    [state.values, state.errors, onValidate]
  );

  const setFieldValue = useCallback((name, value) => {
    if (!isFieldRegistered(name)) return;
    touched.current[name] = true;
    dispatch({ type: 'SET_VALUE', name, value });
  }, []);

  const setFieldError = useCallback((name, error) => {
    if (!isFieldRegistered(name)) return;
    dispatch({ type: 'SET_ERROR', name, error });
  }, []);

  const handleChange = useCallback(({ name, value, error }) => {
    dispatch({ type: 'SET_VALUE', name, value, error });
  }, []);

  const handleBlur = useCallback(({ name }) => {
    if (!isFieldRegistered(name)) return;
    touched.current[name] = true;
    dispatch({ type: 'SET_LAST_TOUCHED_FIELD', name });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET', values: defaultValues });
  }, []);

  const submit = useCallback(
    async (values) => {
      dispatch({ type: 'SET_IS_SUBMITTING', value: true });
      console.log('submit', values);
      const validationResult = await state.validation;
      const errors = validationResult ? validationResult.errors : {};
      const bag = {
        values: state.values,
        errors,
        hasErrors: hasErrors(errors),
        touched: touched.current,
        lastEditedField: state.lastEditedField,
        setFieldValue,
        setFieldError,
        setErrors,
        reset,
      };

      console.log({ validationResult, bag });

      await onSubmit(values, bag);
      dispatch({ type: 'SET_IS_SUBMITTING', value: false });
    },
    [
      onSubmit,
      onValidate,
      state.errors,
      state.lastEditedField,
      reset,
      setFieldValue,
      setFieldError,
      setErrors,
      state.validation,
    ]
  );

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();
      submit(state.values);
    },
    [submit, state.values]
  );

  // minimal context for field
  const form = useMemo(
    () => ({
      register: (name, defaultValue = undefined) => {
        touched.current[name] = false;
        dispatch({ type: 'REGISTER_FIELD', name, value: defaultValue });
      },
      deregister: (name) => {
        delete touched.current[name];
        dispatch({ type: 'UNREGISTER_FIELD', name });
      },
      handleBlur,
      handleChange,
      setFieldError,
      setFieldValue,
      setErrors,
      reset,
      values: state.values,
      errors: state.errors,
      touched: touched.current,
    }),
    [
      handleBlur,
      handleChange,
      setFieldError,
      setFieldValue,
      setErrors,
      reset,
      state.values,
      state.errors,
    ]
  );

  // validation effects

  // on mount
  useSafeEffect(
    (safetyGuard) => {
      console.log(state.version, state.values);
      const { validate } = state.version;
      if (!onValidate || !validate || !validateOnMount) return;
      runValidation(safetyGuard, undefined);
    },
    [state.version]
  );

  // on change
  useSafeEffect(
    (safetyGuard) => {
      const { name } = state.lastEditedField;
      if (!onValidate || !name || !validateOnChange) return;
      runValidation(safetyGuard, name);
    },
    [state.lastEditedField]
  );

  // on blur
  useSafeEffect(
    (safetyGuard) => {
      const { name } = state.lastTouchedField;
      if (!onValidate || !name || !validateOnBlur) return;
      runValidation(safetyGuard, name);
    },
    [state.lastTouchedField]
  );

  return {
    form,
    values: state.values,
    errors: state.errors,
    hasErrors: hasErrors(state.errors),
    touched: touched.current,
    lastEditedField: state.lastEditedField,
    lastTouchedField: state.lastTouchedField,
    version: state.version,
    setFieldValue,
    setFieldError,
    setValues,
    setErrors,
    handleChange,
    handleBlur,
    handleSubmit,
    submit,
    isSubmitting: state.isSubmitting,
    isValidating: state.isValidating,
    reset,
  };
}

export function Field({
  name,
  as: Component,
  form,
  handleChange,
  handleBlur,
  defaultValue,
}) {
  const nameUsedOnMount = useRef(name);

  // TODO ???
  useEffect(() => {
    if (name !== nameUsedOnMount.current)
      throw new Error('Name cannot be changed');
  }, [name]);

  useEffect(() => {
    form.register(name, defaultValue);
    return () => {
      form.deregister(name);
    };
  }, []);

  const hasError = !!form.errors[name];
  const field = (
    <Component
      name={name}
      value={form.values[name]}
      error={form.errors[name]}
      onChange={form.handleChange}
      onBlur={form.handleBlur}
      // TODO ???
      form={form}
    />
  );

  return (
    <div style={hasError ? { border: `1px solid red` } : {}}>
      {field}
      {hasError && <span>{`${name}: ${form.errors[name]}`}</span>}
    </div>
  );
}

// can be optimized even more by pick value/error by name from values/errors
// maybe ignore form?
export const MemoizedField = memo(Field);

//

function Select({ name, value, onChange }) {
  return (
    <select value={value} onChange={nativeOnChangeMapper({ name, onChange })}>
      <option value="a">A</option>
      <option value="b">B</option>
      <option value="c">C</option>
    </select>
  );
}

function Input({ name, value, onChange }) {
  return (
    <input
      type="text"
      name={name}
      value={value}
      onChange={nativeOnChangeMapper({ name, onChange })}
    />
  );
}

function Configurator({ name, value, onChange }) {
  const [inputs, setInputs] = useState([]);

  const onSubmit = useCallback(
    // TODO
    // validation is async therefore it's not possible to have result at the same time as values
    // after onChange (lastEditedField effect)
    // even onSubmit can't have them, because it's not guarantied that validation is already resolved
    async (values, bag) => {
      const { validate, setErrors, errors } = bag;
      console.log('submit configurator', { values, bag });

      const error =
        Object.keys(errors).length > 0
          ? Object.values(errors).join(' | ')
          : false;
      setErrors(errors);
      onChange({
        name,
        value: values,
        error,
      });
    },
    [name, onChange]
  );

  const onValidate = useCallback(async ({ values, errors }) => {
    await delay(1000);
    const x = {};
    if (!values.firstName) x.firstName = 'First name is missing.';
    if (!values.lastName) x.lastName = 'Last name is missing.';
    return { ...errors, ...x };
  }, []);

  const { form, values, setValues, lastEditedField, version, submit } = useForm(
    {
      onSubmit,
      onValidate,
    }
  );

  const fetchData = useCallback(async (safetyGuard, values) => {
    Promise.resolve([
      {
        name: 'firstName',
        value: values.firstName || '',
        parameterConfig: { noRefresh: true },
      },
      { name: 'lastName', value: values.lastName || 'Doe' },
    ])
      .then(safetyGuard.checkEffectValidity)
      .then((inputs) => {
        setInputs(inputs);
        // values are not from form
        const reducedValues = inputs.reduce((acc, { name, value }) => {
          acc[name] = value;
          return acc;
        }, {});
        console.log({ reducedValues });
        setValues(reducedValues, true);
        // submit(reducedValues);
      })
      .catch(() => {
        // ignore invalid effect
      });
  }, []);

  useSafeEffect(
    (safetyGuard) => {
      const { id } = version;
      if (id === 0) fetchData(safetyGuard, value || {});
      submit(values);
    },
    [version]
  );

  useSafeEffect(
    (safetyGuard) => {
      const { name } = lastEditedField;

      if (!name) return;

      const input = inputs.find((input) => input.name === name);
      const isAutoRefreshDisabled =
        input.parameterConfig && input.parameterConfig.noRefresh === true;

      if (isAutoRefreshDisabled) submit(values);
      else fetchData(safetyGuard, values);
    },
    [lastEditedField]
  );

  return inputs.map(({ name, value }) => (
    <Field key={name} as={Input} name={name} form={form} />
  ));
}

function Form() {
  const onSubmit = useCallback(async (data) => {
    console.log(data);
    await delay(2000);
  }, []);

  const onValidate = useCallback(async ({ name, values, errors }) => {
    const x = {};
    if (values.variant === 'a') x.variant = 'Wrong variant';
    if (name) await delay(2000);
    return { ...errors, ...x };
  }, []);

  const {
    form,
    handleSubmit,
    hasErrors,
    errors,
    isValidating,
    isSubmitting,
  } = useForm({
    onSubmit,
    onValidate,
  });

  return (
    <>
      {hasErrors && (
        <ul>
          {Object.values(errors).map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      <form onSubmit={handleSubmit}>
        <Field as={Select} name="variant" form={form} defaultValue="b" />
        <Field as={Configurator} name="config" form={form} />
        <button
          type="submit"
          disabled={hasErrors || isValidating || isSubmitting}
        >
          {isValidating ? 'validating' : isSubmitting ? 'submitting' : 'submit'}
        </button>
      </form>
    </>
  );
}

function App() {
  return (
    <div className="App">
      <Form />
    </div>
  );
}

export default App;
