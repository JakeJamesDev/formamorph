import React, { useState } from 'react';
import { getQuickJS } from 'quickjs-emscripten';

const JsExecutor = () => {
  const [result, setResult] = useState('');
  const [code, setCode] = useState('');

  const executeCode = async () => {
    try {
      // Get the QuickJS engine
      const QuickJS = await getQuickJS();

      // Create a new QuickJS context (VM)
      const vm = QuickJS.newContext();

      // Capture console.log output
      let consoleOutput = '';
      const consoleLog = vm.newFunction('log', (text) => {
        consoleOutput += vm.getString(text) + '\n';
      });

      // Attach custom console object to VM
      const consoleObj = vm.newObject();
      vm.setProp(consoleObj, 'log', consoleLog);
      vm.setProp(vm.global, 'console', consoleObj);

      // Measure start time
      const startTime = Date.now();

      // Execute the provided code
      const result = vm.evalCode(code);

      // Measure end time and calculate duration
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Handle execution result
      if (result.error) {
        setResult(`Execution failed: ${vm.dump(result.error)}\nExecution Time: ${duration} ms`);
        result.error.dispose();
      } else {
        // If there's no explicit result, show captured console output
        const finalResult = consoleOutput.trim() || 'Success: No output from code.';
        setResult(`${finalResult}\nExecution Time: ${duration} ms`);
        result.value.dispose();
      }

      // Clean up
      consoleLog.dispose();
      consoleObj.dispose();
      vm.dispose();
    } catch (error) {
      setResult(`Execution Error: ${error.message}`);
    }
  };

  return (
    <div>
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Write your JavaScript code here"
        rows={10}
        cols={50}
      ></textarea>
      <br />
      <button onClick={executeCode}>Execute Code</button>
      <div>
        <h3>Result:</h3>
        <pre>{result}</pre>
      </div>
    </div>
  );
};

export default JsExecutor;
