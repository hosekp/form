import React, {
  useRef,
  useState,
  useCallback,
  useReducer,
  useMemo,
  useEffect,
  memo,
} from "react";
import useSafeEffect from "use-safe-effect-hook";

export const nativeOnChangeMapper = ({ name, onChange }) => ({
  target: { value },
}) => onChange({ name, value });

const emptyObject = {};

const initialState = {
  values: {},
  errors: {},
  lastTouchedField: { name: undefined },
  lastEditedField: { name: undefined },
  isSubmitting: false,
  isValidating: false,
};

const reducer = (state, action) => {
  switch (action.type) {
    case "SET_VALUE": {
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
    case "SET_LAST_TOUCHED_FIELD":
      return {
        ...state,
        lastTouchedField: { name: action.name },
      };
    case "REGISTER_FIELD":
      return {
        ...state,
        values: { ...state.values, [action.name]: action.value },
      };
    case "UNREGISTER_FIELD": {
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
    case "SET_ERRORS_ONLY":
      return {
        ...state,
        errors: action.errors,
      };
    case "SET_ERRORS":
      return {
        ...state,
        errors: action.errors,
        isValidating: false,
      };
    case "SET_IS_SUBMITTING":
      return {
        ...state,
        isSubmitting: action.value,
      };
    case "SET_IS_VALIDATING":
      return {
        ...state,
        isValidating: action.value,
      };
    case "RESET":
      return {
        ...initialState,
        values: action.values,
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

export function useForm({
  defaultValues = emptyObject,
  onSubmit,
  onChange,
  onValidate = defaultOnValidate,
  validateOnMount = true,
  validateOnChange = true,
  validateOnBlur = true,
}) {
  // registered fields
  const touched = useRef({});
  const [state, dispatch] = useReducer(reducer, { defaultValues }, init);

  const isFieldRegistered = (name) => touched.current[name] !== undefined;

  const $validate = useCallback(
    async (safetyGuard, name) => {
      if (!onValidate) return;
      dispatch({ type: "SET_IS_VALIDATING", value: true });
      const errors = await onValidate({
        name,
        value: state.values[name],
        values: state.values,
        touched: touched.current,
        errors: state.errors,
      });

      try {
        safetyGuard.checkEffectValidity();
        dispatch({ type: "SET_ERRORS", errors });
      } catch (e) {
        // ignore
      }
      return errors;
    },
    [onValidate, state.values, state.errors]
  );

  const setFieldValue = useCallback((name, value) => {
    if (!isFieldRegistered(name)) return;
    touched.current[name] = true;
    dispatch({ type: "SET_VALUE", name, value });
  }, []);

  const handleChange = useCallback(({ name, value, error }) => {
    dispatch({ type: "SET_VALUE", name, value, error });
  }, []);

  const handleBlur = useCallback(({ name }) => {
    if (!isFieldRegistered(name)) return;
    touched.current[name] = true;
    dispatch({ type: "SET_LAST_TOUCHED_FIELD", name });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET", values: defaultValues });
  }, []);

  const submit = useCallback(
    async (values) => {
      dispatch({ type: "SET_IS_SUBMITTING", value: true });
      const actions = {
        errors: state.errors,
        hasErrors: Object.keys(state.errors).length > 0,
        touched: touched.current,
        lastEditedField: state.lastEditedField,
        validate: async () => {
          dispatch({ type: "SET_IS_VALIDATING", value: true });
          const errors = await onValidate({
            name: undefined,
            value: undefined,
            values: values,
            touched: touched.current,
            errors: state.errors,
          });
          dispatch({ type: "SET_IS_VALIDATING", value: false });
          return errors;
        },
        setFieldValue,
        setErrors: (errors) => dispatch({ type: "SET_ERRORS_ONLY", errors }),
        reset,
      };
      await onSubmit(values, actions);
      dispatch({ type: "SET_IS_SUBMITTING", value: false });
    },
    [
      onSubmit,
      onValidate,
      state.errors,
      state.lastEditedField,
      reset,
      setFieldValue,
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
        dispatch({ type: "REGISTER_FIELD", name, value: defaultValue });
      },
      deregister: (name) => {
        delete touched.current[name];
        dispatch({ type: "UNREGISTER_FIELD", name });
      },
      handleBlur,
      handleChange,
      values: state.values,
      errors: state.errors,
      touched: touched.current,
    }),
    [handleBlur, handleChange, state.values, state.errors]
  );

  // validation effects

  useSafeEffect(
    (safetyGuard) => {
      if (!onValidate) return;

      const { name } = state.lastEditedField;

      if (!name) {
        if (!validateOnMount) return;
        $validate(safetyGuard, undefined);
      } else {
        if (!validateOnChange) return;
        $validate(safetyGuard, name);
      }
    },
    [state.lastEditedField]
  );

  useSafeEffect(() => {
    if (!onValidate) return;

    const { name } = state.lastTouchedField;

    if (name) {
      if (!validateOnBlur) return;
      $validate(name);
    }
  }, [state.lastTouchedField]);

  return {
    form,
    values: state.values,
    errors: state.errors,
    hasErrors: Object.keys(state.errors).length > 0,
    touched: touched.current,
    lastEditedField: state.lastEditedField,
    setFieldValue,
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
      throw new Error("Name cannot be changed");
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
    async (values, { validate, setErrors }) => {
      const errors = await validate();
      const error =
        Object.keys(errors).length > 0
          ? Object.values(errors).join(" | ")
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

  const onValidate = useCallback(({ values, errors }) => {
    console.log("validate", values);
    const x = {};
    if (!values.firstName) x.firstName = "First name is missing.";
    if (!values.lastName) x.lastName = "Last name is missing.";
    return { ...errors, ...x };
  }, []);

  const { form, values, lastEditedField, submit } = useForm({
    onSubmit,
    onValidate,
    validateOnChange: false,
    validateOnBlur: false,
    validateOnMount: false,
  });

  const fetchData = useCallback(async (safetyGuard, values) => {
    Promise.resolve([
      { name: "firstName", value: "", parameterConfig: { noRefresh: true } },
      { name: "lastName", value: "Doe" },
    ])
      .then(safetyGuard.checkEffectValidity)
      .then((inputs) => {
        setInputs(inputs);
        // values are not from form
        const reducedValues = inputs.reduce((acc, { name, value }) => {
          acc[name] = value || values[name];
          return acc;
        }, {});
        submit(reducedValues);
      })
      .catch(() => {
        // ignore invalid effect
      });
  }, []);

  useSafeEffect((safetyGuard) => {
    submit({});
    // TODO values from outside
    fetchData(safetyGuard, value || {});
  }, []);

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
    <Field key={name} as={Input} name={name} defaultValue={value} form={form} />
  ));
}

const delay = (t) => new Promise((res) => setTimeout(res, t));

function Form() {
  const onSubmit = useCallback(async (data) => {
    console.log(data);
    await delay(2000);
  });
  const onValidate = useCallback(async ({ values, errors }) => {
    const x = {};
    if (values.variant === "a") x.variant = "Wrong variant";
    await delay(2000);
    return { ...errors, ...x };
  });
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
          submit
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
