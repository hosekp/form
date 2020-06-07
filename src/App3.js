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
  createContext,
  useContext,
  Fragment,
} from "react";
import useSafeEffect from "use-safe-effect-hook";
import {
  RecoilRoot,
  atomFamily,
  selectorFamily,
  useRecoilState,
  useSetRecoilState,
  useRecoilValue,
  useRecoilCallback,
  waitForAll,
  useRecoilValueLoadable,
} from "recoil";

const delay = (t) => new Promise((res) => setTimeout(res, t));

export const nativeOnChangeMapper = ({ name, onChange }) => ({
  target: { value },
}) => onChange({ name, value });

export const $form = atomFamily({
  key: `form`,
  default: (id) => ({ id, fieldIds: [], isSubmitting: false }),
});

export const $field = atomFamily({
  key: "form_field",
  default: (id) => {
    const [formId, name] = id.split("_");
    const validationResult = Promise.resolve([name, null]);
    return {
      id,
      formId,
      name,
      value: undefined,
      touched: false,
      required: false, // TODO
      validation: validationResult,
      validator: (value, touched) => validationResult,
    };
  },
});

export const $fieldValidation = selectorFamily({
  key: "form_field_validation",
  get: (id) => ({ get }) => get($field(id)).validation,
});

export const $formValidation = selectorFamily({
  key: "form_validation",
  get: (formId) => ({ get }) => {
    const { fieldIds } = get($form(formId));
    return waitForAll(
      fieldIds.map((id) => $fieldValidation(`${formId}_${id}`))
    );
  },
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

export function Validation({ name, formId }) {
  formId = useContext(FormContext) || formId;
  const [, error] = useRecoilValue($fieldValidation(`${formId}_${name}`));
  return error ? <span style={{ color: "red" }}>{error}</span> : null;
}

export function FormValidation({ formId }) {
  formId = useContext(FormContext) || formId;
  const validationPairs = useRecoilValue($formValidation(formId));
  return (
    <div>
      {validationPairs
        .filter(([, error]) => !!error)
        .map(([name, error]) => `${name}: ${error}`)}
    </div>
  );
}

const FormContext = createContext();

export function FormIdProvider({ children }) {
  const [formId] = useState(() => `form/${Math.random()}`);
  return <FormContext.Provider value={formId}>{children}</FormContext.Provider>;
}

export function useForm({ name, onSubmit, defaultValues = {} }) {
  name = useContext(FormContext) || name;

  const [{ isSubmitting }, setForm] = useRecoilState($form(name));
  const fields = useRecoilValue($fields(name));

  const setValues = useRecoilCallback(
    ({ set }, values, validate) => {
      console.log("setValues", values);
      Object.keys(values).forEach((id) =>
        set($field(`${name}_${id}`), (state) => ({
          ...state,
          value: values[id],
          validation: validate ? state.validator(values[id]) : state.validation,
        }))
      );
    },
    [name]
  );

  const setErrors = useRecoilCallback(
    ({ set }, errors) => {
      Object.keys(errors).forEach((id) =>
        set($field(`${name}_${id}`), (state) => ({
          ...state,
          validation: Promise.resolve([id, errors[id]]),
        }))
      );
    },
    [name]
  );

  const submit = useRecoilCallback(
    async ({ getPromise }) => {
      setForm((state) => ({ ...state, isSubmitting: true }));

      const fields = await getPromise($fields(name));
      const validationPairs = await getPromise($formValidation(name));

      console.log(fields);

      await onSubmit({
        values: fields.reduce((acc, { name, value }) => {
          if (value) acc[name] = value;
          return acc;
        }, {}),
        touched: fields.reduce((acc, { name, touched }) => {
          acc[name] = touched;
          return acc;
        }, {}),
        setValues,
        setErrors,
        validation: validationPairs.reduce((acc, [name, error]) => {
          if (error) acc[name] = error;
          return acc;
        }, {}),
      });

      setForm((state) => ({ ...state, isSubmitting: false }));
    },
    [name, onSubmit, setValues, setErrors]
  );

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();
      submit();
    },
    [submit]
  );

  useEffect(() => {
    setValues(defaultValues);
  }, []);

  // TODO fieldIds add, remove, swap, removeAtIndex, addAtIndex

  return {
    id: name,
    fields,
    setValues,
    setErrors,
    isSubmitting,
    submit,
    handleSubmit,
  };
}

const emptyValidator = (value) => null;

function useValidationResult({ name, formId }) {
  const result = useRecoilValueLoadable($fieldValidation(`${formId}_${name}`));
  return result.state === "hasValue" && result.contents[1] !== null;
}

export function useField({
  name,
  formId,
  defaultValue,
  required,
  validator = emptyValidator,
  onChange: onChangeCb,
}) {
  formId = useContext(FormContext) || formId;

  const setFormState = useSetRecoilState($form(formId));
  const [fieldState, setFieldState] = useRecoilState(
    $field(`${formId}_${name}`)
  );
  const invalid = useValidationResult({ name, formId });

  const onBlur = useCallback(() => {
    setFieldState((state) => ({ ...state, touched: true }));
  }, [setFieldState]);

  const delayedOnChangeCb = useRef();

  const onChange = useCallback(({ name, value }) => {
    setFieldState((state) => ({
      ...state,
      touched: true,
      value,
      validation: state.validator(value),
    }));
    delayedOnChangeCb.current = { name, value };
  }, []);

  useSafeEffect(
    (safetyGuard) => {
      if (delayedOnChangeCb.current) {
        onChangeCb && onChangeCb(safetyGuard, delayedOnChangeCb.current);
        delayedOnChangeCb.current = undefined;
      }
    },
    [delayedOnChangeCb.current]
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
    setFieldState((state) => {
      const wrappedValidator = async (value) => [
        state.name,
        await validator(value),
      ];
      return {
        ...state,
        required, // TODO
        validator: wrappedValidator,
        validation: wrappedValidator(state.value),
      };
    });
  }, [required, validator]);

  return { ...fieldState, formId, invalid, onBlur, onChange };
}

export function Field({
  name,
  as: Component,
  wrapWithFormIdProvider,
  formId,
  defaultValue,
  required,
  validator,
  onBlur,
  onChange,
  ...other
}) {
  const field = useField({
    name,
    formId,
    defaultValue,
    required,
    validator,
    onChange,
  });

  const Wrapper = useMemo(() => {
    return wrapWithFormIdProvider ? FormIdProvider : Fragment;
  }, [wrapWithFormIdProvider]);

  return (
    <div style={field.invalid ? { border: "1px solid red" } : undefined}>
      <Wrapper>
        <Component {...other} {...field} />
      </Wrapper>
      <Suspense fallback="validating">
        <Validation name={name} />
      </Suspense>
    </div>
  );
}

export const FieldMemo = memo(Field);

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

function Configurator({ name, value, onChange, propagateErrorToOuterForm }) {
  const [inputs, setInputs] = useState([]);
  const [loading, setLoading] = useState(true);

  const notReadyYet = useMemo(() => {
    return loading ? { [name]: "not ready yet" } : {};
  }, [name, loading]);

  const onSubmit = useCallback(
    async ({ values, validation }) => {
      console.log("submit config", values, validation);
      onChange({ name, value: values });
      propagateErrorToOuterForm(
        Object.keys(validation).length === 0
          ? notReadyYet
          : { ...notReadyYet, [name]: "Something is wrong :)" }
      );
    },
    [name, onChange, propagateErrorToOuterForm, notReadyYet]
  );

  const { id, submit, handleSubmit, setValues } = useForm({
    defaultValues: value,
    onSubmit,
  });

  const fetchData = useCallback(
    async (safetyGuard, values = {}) => {
      console.log("fetchData", values);
      propagateErrorToOuterForm(notReadyYet);
      setLoading(true);
      await delay(3000);
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
          setLoading(false);
          setValues(reducedValues, true);
          submit();
        })
        .catch(() => {
          // ignore invalid effect
        });
    },
    [submit, setValues, propagateErrorToOuterForm, notReadyYet]
  );

  const onChangeCb = useRecoilCallback(
    async ({ getPromise }, safetyGuard, { name, value }) => {
      console.log("onChange", name, value);
      const input = inputs.find((input) => input.name === name);
      const isAutoRefreshDisabled =
        input.parameterConfig && input.parameterConfig.noRefresh === true;

      if (isAutoRefreshDisabled) submit();
      else fetchData(safetyGuard, await getPromise($values(id)));
    },
    [id, submit, inputs]
  );

  const requiredRule = useCallback((value) => (value ? null : "required"), []);

  useSafeEffect((safetyGuard) => {
    fetchData(safetyGuard, value);
    submit();
  }, []);

  return (
    <form onSubmit={handleSubmit}>
      {inputs.map(({ name }) => (
        <FieldMemo
          key={name}
          as={Input}
          name={name}
          onChange={onChangeCb}
          required
          validator={requiredRule}
        />
      ))}
    </form>
  );
}

function SomeForm() {
  const onSubmit = useCallback(async (bag) => {
    console.log("onSubmit", bag);
    bag.setValues({ variant: "c" });
    bag.setErrors({ y: "fuck!" });
    await delay(2000);
  }, []);

  const { isSubmitting, handleSubmit, setErrors } = useForm({
    onSubmit,
  });

  const validator = useCallback(async (value) => {
    await delay(1000);
    return value === "foo" ? "bar" : null;
  }, []);

  return (
    <>
      <form onSubmit={handleSubmit}>
        <FieldMemo
          as={Select}
          name="variant"
          // formId={formId}
          defaultValue="b"
        />
        <FieldMemo as={Select} name="x" defaultValue="b" />
        <FieldMemo
          as={Input}
          name="y"
          defaultValue=""
          required
          validator={validator}
        />
        <FieldMemo
          as={Configurator}
          wrapWithFormIdProvider
          name="config"
          propagateErrorToOuterForm={setErrors}
        />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "submitting" : "submit"}
        </button>
        <Suspense fallback="validating form">
          <FormValidation />
        </Suspense>
      </form>
    </>
  );
}

function App() {
  return (
    <RecoilRoot>
      <div className="App">
        <FormIdProvider>
          <SomeForm />
        </FormIdProvider>
      </div>
    </RecoilRoot>
  );
}

export default App;
