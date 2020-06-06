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
  waitForAll,
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
    return {
      id,
      formId,
      name,
      value: undefined,
      touched: false,
      required: false, // TODO
      validation: Promise.resolve([name, null]),
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

export function useForm({ name, onSubmit, onValidate }) {
  const [{ isSubmitting }, setForm] = useRecoilState($form(name));

  const setValues = useRecoilCallback(({ set }, values) => {
    Object.keys(values).forEach((id) =>
      set($field(`${name}_${id}`), (state) => ({
        ...state,
        value: values[id],
      }))
    );
  }, []);

  const setErrors = useRecoilCallback(({ set }, errors) => {
    Object.keys(errors).forEach((id) =>
      set($field(`${name}_${id}`), (state) => ({
        ...state,
        validation: Promise.resolve([id, errors[id]]),
      }))
    );
  }, []);

  const submit = useRecoilCallback(
    async ({ getPromise }) => {
      setForm((state) => ({ ...state, isSubmitting: true }));

      const fields = await getPromise($fields(name));
      const validationPairs = await getPromise($formValidation(name));

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

  return {
    isSubmitting,
    submit,
    handleSubmit,
  };
}

const emptyValidator = (value) => null;

export function useField({
  name,
  formId,
  defaultValue,
  required,
  validator = emptyValidator,
}) {
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
      required, // TODO
      validator: async (value) => [state.name, await validator(value)],
    }));
  }, [required, validator]);

  return { ...fieldState, onBlur, onChange };
}

export function Validation({ name, formId }) {
  const [, error] = useRecoilValue($fieldValidation(`${formId}_${name}`));
  return error ? <span style={{ color: "red" }}>{error}</span> : null;
}

function FormValidation({ formId }) {
  const validationPairs = useRecoilValue($formValidation(formId));
  return (
    <div>
      {validationPairs
        .filter(([, error]) => !!error)
        .map(([name, error]) => `${name}: ${error}`)}
    </div>
  );
}

export function Field({
  name,
  as: Component,
  formId,
  defaultValue,
  required,
  validator,
}) {
  const { value, onBlur, onChange } = useField({
    name,
    formId,
    defaultValue,
    required,
    validator,
  });
  return (
    <>
      <Component
        name={name}
        value={value}
        onBlur={onBlur}
        onChange={onChange}
        required={required}
      />
      <Suspense fallback="validating">
        <Validation name={name} formId={formId} />
      </Suspense>
    </>
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
    bag.setValues({ variant: "c" });
    bag.setErrors({ y: "fuck!" });
    await delay(2000);
  }, []);

  const formId = "foo";

  const { isSubmitting, handleSubmit } = useForm({
    name: formId,
    onSubmit,
  });

  const validator = useCallback(async (value) => {
    await delay(3000);
    return value === "foo" ? ["bar"] : [];
  }, []);

  return (
    <>
      <form onSubmit={handleSubmit}>
        <FieldMemo
          as={Select}
          name="variant"
          formId={formId}
          defaultValue="b"
        />
        <FieldMemo as={Select} name="x" formId={formId} defaultValue="b" />
        <FieldMemo
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
        <Suspense fallback="validating form">
          <FormValidation formId={formId} />
        </Suspense>
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
