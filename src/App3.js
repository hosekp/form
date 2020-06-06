import React, {
  useRef,
  useState,
  useCallback,
  useReducer,
  useMemo,
  useEffect,
  memo,
  ErrorBoundary,
  Suspense,
} from "react";
import useSafeEffect from "use-safe-effect-hook";
import {
  RecoilRoot,
  atom,
  atomFamily,
  selector,
  selectorFamily,
  useRecoilState,
  useSetRecoilState,
  useRecoilValue,
  useRecoilCallback,
} from "recoil";

const delay = (t) => new Promise((res) => setTimeout(res, t));

export const nativeOnChangeMapper = ({ name, onChange }) => ({
  target: { value },
}) => onChange({ name, value });

export const $form = atomFamily({
  key: `form`,
  default: (id) => ({ id, fieldIds: [], isSubmitting: false }),
});

const emptyP = Promise.resolve([]);

export const $field = atomFamily({
  key: "form_field",
  default: (id) => ({
    id,
    name: id.split("_")[1],
    value: undefined,
    touched: false,
    error: undefined,
    required: false,
    validation: emptyP,
  }),
});

export const $fieldValidation = selectorFamily({
  key: "form_field_validation",
  get: (id) => ({ get }) => get($field(id)).validation,
});

export const $fields = selectorFamily({
  key: "form_fields",
  get: (formId) => ({ get }) => {
    const { fieldIds } = get($form(formId));
    return fieldIds.map((id) => get($field(`${formId}_${id}`)));
  },
});

export const $values = selectorFamily({
  key: "form_values",
  get: (formId) => ({ get }) => {
    return get($fields(formId)).map(({ value }) => value);
  },
});

export const $errors = selectorFamily({
  key: "form_values",
  get: (formId) => ({ get }) => {
    const errors = get($fields(formId)).reduce((acc, { name, error }) => {
      if (error) acc[name] = error;
      return acc;
    }, {});
    return { errors, hasErrors: Object.keys(errors).length > 0 };
  },
});

export function useForm({ name, onSubmit, onValidate }) {
  const [{ isSubmitting }, setForm] = useRecoilState($form(name));
  const errors = useRecoilValue($errors(name));

  const setErrors = useRecoilCallback(({ set }, errors) => {
    Object.keys(errors).forEach((id) =>
      set($field(`${name}_${id}`), (state) => ({ ...state, error: errors[id] }))
    );
  }, []);

  const submit = useRecoilCallback(
    async ({ getPromise }) => {
      setForm((state) => ({ ...state, isSubmitting: true }));
      const fields = await getPromise($fields(name));
      await onSubmit({
        values: fields.reduce((acc, { name, value }) => {
          if (value) acc[name] = value;
          return acc;
        }, {}),
        touched: fields.reduce((acc, { name, touched }) => {
          acc[name] = touched;
          return acc;
        }, {}),
        setErrors,
      });
      setForm((state) => ({ ...state, isSubmitting: false }));
    },
    [name, onSubmit, setErrors]
  );

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();
      submit();
    },
    [submit]
  );

  return {
    ...errors,
    isSubmitting,
    submit,
    handleSubmit,
  };
}

export function useField({ name, formId, defaultValue, required, validator }) {
  const setFormState = useSetRecoilState($form(formId));
  const [fieldState, setFieldState] = useRecoilState(
    $field(`${formId}_${name}`)
  );

  const onBlur = useCallback(() => {
    setFieldState((state) => ({ ...state, touched: true }));
  }, [setFieldState]);

  const onChange = useCallback(
    ({ value }) => {
      setFieldState((state) => ({
        ...state,
        touched: true,
        value,
        validation: state.validator(value),
      }));
    },
    [setFieldState]
  );

  useEffect(() => {
    setFormState((state) => ({
      ...state,
      fieldIds: [...state.fieldIds, name],
    }));
    return () => {
      // TODO reset
      setFieldState(() => undefined);
      setFormState((state) => ({
        ...state,
        fieldIds: state.fieldIds.filter((id) => id === name),
      }));
    };
  }, []);

  useEffect(() => {
    setFieldState((state) => ({
      ...state,
      value: state.value || defaultValue,
    }));
  }, []);

  useEffect(() => {
    setFieldState((state) => ({
      ...state,
      required,
      validator,
    }));
  }, [required, validator]);

  return { ...fieldState, onBlur, onChange };
}

export function Validation({ name, formId }) {
  const error = useRecoilValue($fieldValidation(`${formId}_${name}`));
  return <span style={{ color: "red" }}>{error}</span>;
}

export function Field({
  name,
  as: Component,
  formId,
  defaultValue,
  required,
  validator,
}) {
  const { value, error, onBlur, onChange } = useField({
    name,
    formId,
    defaultValue,
    required,
    validator,
  });
  const hasError = !!error;
  const field = (
    <>
      <Component
        name={name}
        value={value}
        error={error}
        onBlur={onBlur}
        onChange={onChange}
        required={required}
      />
      <Suspense fallback="validating">
        <Validation name={name} formId={formId} />
      </Suspense>
    </>
  );

  return (
    <div style={hasError ? { border: `1px solid red` } : {}}>
      {field}
      {hasError && <span>{`${name}: ${error}`}</span>}
    </div>
  );
}

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
      console.log("submit configurator", { values, bag });

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

  const onValidate = useCallback(async ({ values, errors }) => {
    await delay(1000);
    const x = {};
    if (!values.firstName) x.firstName = "First name is missing.";
    if (!values.lastName) x.lastName = "Last name is missing.";
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
        name: "firstName",
        value: values.firstName || "",
        parameterConfig: { noRefresh: true },
      },
      { name: "lastName", value: values.lastName || "Doe" },
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

function SomeForm() {
  const onSubmit = useCallback(async (bag) => {
    console.log("onSubmit", bag);
    bag.setErrors({ y: "fuck!" });
    await delay(2000);
  }, []);

  const onValidate = useCallback(async (values) => {
    const errors = {};
    if (values.variant === "a") errors.variant = "invalid variant";
    return errors;
  }, []);

  const formId = "foo";

  const { isSubmitting, handleSubmit, errors, hasErrors } = useForm({
    name: formId,
    onSubmit,
    onValidate,
  });

  const validator = useCallback(async (value) => {
    await delay(3000);
    return value === "foo" ? ["bar"] : [];
  }, []);

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
        <Field as={Select} name="variant" formId={formId} defaultValue="b" />
        <Field as={Select} name="x" formId={formId} defaultValue="b" />
        <Field
          as={Input}
          name="y"
          formId={formId}
          defaultValue=""
          required
          validator={validator}
        />
        {/* <Field as={Configurator} name="config" form={form} /> */}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "submitting" : "submit"}
        </button>
      </form>
    </>
  );
}

function App() {
  return (
    <RecoilRoot>
      <div className="App">
        <SomeForm />
      </div>
    </RecoilRoot>
  );
}

export default App;
