import React from 'react';
import { RecoilRoot } from 'recoil';

import SomeForm from './SomeForm';

import 'antd/dist/antd.css';

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
