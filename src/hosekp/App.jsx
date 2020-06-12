import React, { useCallback, useState } from 'react';
import { Select, Input, Form } from 'antd';
import Configurator from './Configurator';
import { delay } from './utils';

import 'antd/dist/antd.css';

const Item = Form.Item;
const Option = Select.Option;

const formItemLayout = {
  labelCol: {
    xs: { span: 24 },
    sm: { span: 8 },
  },
  wrapperCol: {
    xs: { span: 24 },
    sm: { span: 16 },
  },
};

function App() {
  const [isSubmitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const initialValues = {
    variant: 'b',
    x: 'b',
    config: { firstName: 'John' },
  };
  const validator = useCallback((value) => {
    return delay(1000).then(() => {
      return value === 'foo' ? 'bar' : null;
    });
  }, []);

  const handleSubmit = (values) => {
    console.log(values);
  };

  return (
    <Form
      form={form}
      name="basic"
      {...formItemLayout}
      onSubmit={handleSubmit}
      initialValues={initialValues}
      //onValuesChange={onFormLayoutChange}
    >
      <Item name="variant" label="variant">
        <Select>
          <Option value="a">A</Option>
          <Option value="b">B</Option>
          <Option value="c">C</Option>
        </Select>
      </Item>
      <Item name="x" label="method">
        <Select>
          <Option value="a">A</Option>
          <Option value="b">B</Option>
          <Option value="c">C</Option>
        </Select>
      </Item>
      <Item name="y" rules={['required', { validator }]} label="name">
        <Input />
      </Item>
      <Item name="config">
        <Configurator name="config" />
      </Item>
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'submitting' : 'submit'}
      </button>
    </Form>
  );
}

/*<Suspense fallback="validating form">*/
/*  <FormValidation />*/
/*</Suspense>*/

export default App;
