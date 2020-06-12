import React from 'react';
import { useForm, Controller } from 'react-hook-form';

const nativeOnChangeMapper = (onChange) => ({ target: { value } }) =>
  onChange({ value });

function Select({ value, onChange }) {
  return (
    <select value={value} onChange={onChange}>
      <option value="a">A</option>
      <option value="b">B</option>
      <option value="c">C</option>
    </select>
  );
}

function Configurator({ value, onChange }) {
  const { register, handleSubmit, errors } = useForm();

  console.log(errors);

  const onSubmit = (data) => console.log('submit inner', data);

  return <input name="name" defaultValue="test" ref={register} />;
}

function Form() {
  const { control, watch, register, handleSubmit, errors } = useForm();

  console.log(errors);

  console.log(watch(['foo', 'variant']));

  const onSubmit = (data) => console.log('submit', data);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input name="foo" defaultValue="test" ref={register} />
      <Controller
        as={Select}
        name="variant"
        control={control}
        defaultValue="b"
      />
      <Configurator />
      <input type="submit" />
    </form>
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
