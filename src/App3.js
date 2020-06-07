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
  default: (id) => ({ id, fieldIds: [], submission: Promise.resolve(null) }),
});

export const $formSubmission = selectorFamily({
  key: "form_submission",
  get: (id) => ({ get }) => get($form(id)).submission,
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
      validator: (value) => validationResult,
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
    return get($fields(formId)).reduce((acc, { name, value }) => {
      if (value) acc[name] = value;
      return acc;
    }, {});
  },
});

export function Validation({ name, formId }) {
  const formIdFromContext = useContext(FormContext);
  formId = formId || formIdFromContext;
  const [, error] = useRecoilValue($fieldValidation(`${formId}_${name}`));
  return error ? <span style={{ color: "red" }}>{error}</span> : null;
}

export function FormValidation({ formId }) {
  const formIdFromContext = useContext(FormContext);
  formId = formId || formIdFromContext;
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

export function useCallbackInNextRender() {
  const [cb, setCb] = useState(null);

  useSafeEffect(
    (safetyGuard) => {
      if (!cb) return;
      const [callback, args] = cb;
      callback(safetyGuard, ...args);
      // setCb(null);
    },
    [cb]
  );

  return useCallback((callback, ...args) => {
    setCb([callback, args]);
  }, []);
}

export function useForm({
  formId,
  onSubmit,
  defaultValues = {},
  resetOnUnmount = true,
}) {
  const formIdFromContext = useContext(FormContext);
  formId = formId || formIdFromContext;

  const setForm = useSetRecoilState($form(formId));
  const isSubmitting = useRecoilValueLoadable($formSubmission(formId));
  const fields = useRecoilValue($fields(formId));

  const setValues = useRecoilCallback(
    ({ set }, values, validate) => {
      Object.keys(values).forEach((id) =>
        set($field(`${formId}_${id}`), (state) => ({
          ...state,
          value: values[id],
          validation: validate ? state.validator(values[id]) : state.validation,
        }))
      );
    },
    [formId]
  );

  const setErrors = useRecoilCallback(
    ({ set }, errors) => {
      Object.keys(errors).forEach((id) =>
        set($field(`${formId}_${id}`), (state) => ({
          ...state,
          validation: Promise.resolve([id, errors[id]]),
        }))
      );
    },
    [formId]
  );

  const setTouched = useRecoilCallback(
    ({ set }, touched) => {
      Object.keys(touched).forEach((id) =>
        set($field(`${formId}_${id}`), (state) => ({
          ...state,
          touched: touched[id],
        }))
      );
    },
    [formId]
  );

  const reset = useRecoilCallback(
    async ({ reset, getPromise, set }) => {
      const { fieldIds } = await getPromise($form(formId));
      reset($form(formId));
      fieldIds.forEach((id) => set($field(`${formId}_${id}`, () => undefined)));
    },
    [formId]
  );

  const submit = useRecoilCallback(
    async ({ getPromise }) => {
      const fields = await getPromise($fields(formId));
      const validationPairs = await getPromise($formValidation(formId));

      await onSubmit({
        values: fields.reduce((acc, { name, value }) => {
          if (value) acc[name] = value;
          return acc;
        }, {}),
        touched: fields.reduce((acc, { name, touched }) => {
          acc[name] = touched;
          return acc;
        }, {}),
        fieldIds: fields.map(({ name }) => name),
        setValues,
        setErrors,
        setTouched,
        validation: validationPairs.reduce((acc, [name, error]) => {
          if (error) acc[name] = error;
          return acc;
        }, {}),
        reset,
      });
    },
    [formId, onSubmit, setValues, setErrors, setTouched, reset]
  );

  const createSubmitPromise = useCallback(() => {
    const submission = submit();
    setForm((state) => ({ ...state, submission }));
    return submission;
  }, [submit]);

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();
      createSubmitPromise();
    },
    [createSubmitPromise]
  );

  useEffect(() => {
    setValues(defaultValues);
    return () => {
      resetOnUnmount && reset();
    };
  }, []);

  // TODO fieldIds add, remove, swap, removeAtIndex, addAtIndex

  return {
    formId,
    fields,
    setValues,
    setErrors,
    isSubmitting: isSubmitting.state === "loading",
    submit: createSubmitPromise,
    handleSubmit,
    reset,
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
  let formIdFromContext = useContext(FormContext);
  formId = formId || formIdFromContext;

  const setFormState = useSetRecoilState($form(formId));
  const [fieldState, setFieldState] = useRecoilState(
    $field(`${formId}_${name}`)
  );
  const invalid = useValidationResult({ name, formId });

  const onBlur = useCallback(() => {
    setFieldState((state) => ({ ...state, touched: true }));
  }, [setFieldState]);

  const delayOnChange = useCallbackInNextRender();

  const onChange = useCallback(
    ({ name, value, error, touched = true }) => {
      setFieldState((state) => ({
        ...state,
        touched,
        value,
        validation: error
          ? Promise.resolve([state.name, error])
          : state.validator(value),
      }));
      onChangeCb && delayOnChange(onChangeCb, { name, value });
    },
    [onChangeCb]
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

  return { ...fieldState, defaultValue, formId, invalid, onBlur, onChange };
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
  label,
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
    <div
      style={
        field.touched && field.invalid ? { border: "1px solid red" } : undefined
      }
    >
      <Wrapper>
        {label && (
          <div>
            <label>
              {label}
              {required ? <span style={{ color: "red" }}>*</span> : null}
            </label>
          </div>
        )}
        <Component {...other} {...field} />
      </Wrapper>
      {field.touched && (
        <Suspense fallback="validating">
          <Validation name={name} />
        </Suspense>
      )}
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

const $test = atomFamily({
  key: "test",
  default: { a: 0, b: 0 },
});

function Configurator({
  name,
  defaultValue,
  onChange,
  setOnReady,
  propagateErrorToOuterForm,
}) {
  const [inputs, setInputs] = useState([]);
  const loading = useRef(true);

  const onSubmit = useCallback(
    async (bag) => {
      const { values, validation } = bag;
      console.log("submit config", bag, loading.current);
      const possiblyNotReadyYet = loading.current
        ? { [name]: "not ready yet" }
        : {};
      const possiblyError =
        Object.keys(validation).length === 0
          ? {}
          : {
              [name]: `Fields ${Object.keys(validation).join(
                ", "
              )} is missing.`,
            };
      // TODO passing error here is workaround for https://github.com/facebookexperimental/Recoil/issues/279
      onChange({
        name,
        value: values,
        error: { ...possiblyNotReadyYet, ...possiblyError }[name],
      });
      // propagateErrorToOuterForm({ ...possiblyNotReadyYet, ...possiblyError });
    },
    [name, onChange, propagateErrorToOuterForm]
  );

  const { formId, submit, handleSubmit, setValues } = useForm({
    defaultValues: defaultValue,
    onSubmit,
  });

  const setDelayedSubmit = useCallbackInNextRender();

  const fetchData = useCallback(
    async (safetyGuard, values = {}) => {
      // console.log("fetchData", values);
      propagateErrorToOuterForm({ [name]: "not ready yet" });
      loading.current = true;
      await delay(3000);
      Promise.resolve([
        {
          name: "firstName",
          value: values.firstName || "",
          parameterConfig: { noRefresh: true },
          label: "First Name",
        },
        {
          name: "lastName",
          value: values.lastName || "Doe",
          label: "Last Name",
        },
      ])
        .then(safetyGuard.checkEffectValidity)
        .then((inputs) => {
          setInputs(inputs);
          // values are not from form
          const reducedValues = inputs.reduce((acc, { name, value }) => {
            acc[name] = value;
            return acc;
          }, {});
          // console.log({ values, reducedValues });
          loading.current = false;
          setValues(reducedValues, true);
          // TODO ??? is it ok
          setDelayedSubmit(submit);
          // submit();
        })
        // TODO hack to be able to read values from atoms
        // setValues() -> submit()
        // .then(() => delay(5))
        // .then(() => submit())
        .catch(() => {
          // ignore invalid effect
        });
    },
    [name, submit, setValues, propagateErrorToOuterForm]
  );

  const onChangeCb = useRecoilCallback(
    async ({ getPromise }, safetyGuard, { name, value }) => {
      const input = inputs.find((input) => input.name === name);
      const isAutoRefreshDisabled =
        input.parameterConfig && input.parameterConfig.noRefresh === true;

      if (isAutoRefreshDisabled) submit();
      else fetchData(safetyGuard, await getPromise($values(formId)));
    },
    [formId, submit, inputs]
  );

  const requiredRule = useCallback((value) => (value ? null : "required"), []);

  useSafeEffect((safetyGuard) => {
    // console.log("on init", defaultValue);
    fetchData(safetyGuard, defaultValue);
    submit();
  }, []);

  // TEST
  // const [x, setX] = useState({ a: 0, b: 0 });
  // const [y, setY] = useRecoilState($test("xyz"));

  // const setYCB = useRecoilCallback(({ set }, n) => {
  //   set($test("xyz"), (x) => ({ ...x, c: n }));
  // }, []);

  // useEffect(() => {
  //   setX((x) => ({ ...x, a: 1 }));
  //   setX((x) => ({ ...x, b: 1 }));
  //   setY((x) => ({ ...x, a: 1 }));
  //   setY((x) => ({ ...x, b: 1 }));
  //   setYCB(1);
  // }, []);

  // useEffect(() => {
  //   console.log("xxxxxx", x);
  // }, [x]);

  // useEffect(() => {
  //   console.log("yyyyyy", y);
  // }, [y]);

  return (
    <form onSubmit={handleSubmit}>
      {inputs.map(({ name, label }) => (
        <FieldMemo
          key={name}
          as={Input}
          name={name}
          onChange={onChangeCb}
          required
          validator={requiredRule}
          label={label}
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
          label="variant"
        />
        <FieldMemo as={Select} name="x" defaultValue="b" label="method" />
        <FieldMemo
          as={Input}
          name="y"
          defaultValue=""
          required
          validator={validator}
          label="name"
        />
        <FieldMemo
          as={Configurator}
          wrapWithFormIdProvider
          name="config"
          defaultValue={{ firstName: "John" }}
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
