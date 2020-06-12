import { delay } from './utils';

const api = {
  post: function post(url, data) {
    const values = data.values;
    const response = [
      {
        name: 'firstName',
        value: values.firstName || '',
        parameterConfig: { noRefresh: true },
        label: 'First Name',
      },
      values.lastName &&
        values.lastName.startsWith('J') && {
          name: 'middleName',
          value: values.middleName || 'Chicken',
          label: 'Middle Name',
        },
      {
        name: 'lastName',
        value: values.lastName || 'Doe',
        label: 'Last Name',
      },
    ].filter((a) => a);
    return delay(3000).then(() => response);
  },
};

export default api;
