// VIBE_NOTE: Do not escape backticks or dollar signs in template literals in this file.
// Escaping is only for 'implementationCode' strings in tool definitions.
// FIX: Reverted from namespace import to default import for consistency and to resolve component type issues.
// The previous namespace import (`import * as React`) was an attempted fix for type resolution issues
// in ErrorBoundary, but the errors persisted. Using a standard default import aligns with other files
// and should allow TypeScript to correctly recognize React.Component inheritance.
// FIX: Import Component directly to resolve type inheritance issues for ErrorBoundary.
import React, { Component } from 'react';
import type { LLMTool, UIToolRunnerProps } from '../types';
import DebugLogView from './ui_tools/DebugLogView';
import * as Icons from './icons';

// Tell TypeScript about the global Babel object from the script tag in index.html
declare var Babel: any;

interface UIToolRunnerComponentProps {
  tool: LLMTool;
  props: UIToolRunnerProps;
}

// A wrapper to catch runtime errors in the compiled component.
// It now resets its error state if the tool being rendered changes.
type ErrorBoundaryProps = {
  fallback: React.ReactNode;
  toolName: string;
  children?: React.ReactNode;
};
type ErrorBoundaryState = {
  hasError: boolean;
};

// FIX: Switched to a class property for state initialization and removed the constructor.
// This is a more modern and robust approach that avoids potential issues with `this`
// in the constructor. It explicitly adds the `state` property to the class type,
// which should resolve the reported TypeScript errors about `state`, `props`, and `setState`
// not existing on the component instance, which likely stem from a type resolution issue
// with the component's inheritance.
// FIX: Reverted to using `React.Component` instead of `Component`. While `Component` is imported,
// using the fully qualified `React.Component` can resolve module resolution issues that cause
// TypeScript to fail to recognize the component's inheritance and its properties like `props` and `setState`.
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    console.error("UI Tool Runner caught an error:", error);
    return { hasError: true };
  }

  componentDidUpdate(prevProps: Readonly<ErrorBoundaryProps>) {
    if (this.props.toolName !== prevProps.toolName) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`UI Tool Runner Error in tool '${this.props.toolName}':`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

const UIToolRunner: React.FC<UIToolRunnerComponentProps> = ({ tool, props }) => {
  // Memoize the compiled component to prevent re-compiling and re-mounting on every render,
  // which was causing the flickering and state loss in complex components like the interactive graph.
  const CompiledComponent = React.useMemo(() => {
    if (tool.category !== 'UI Component') {
      return () => <div>Error: Tool "{tool.name}" is not a UI Component.</div>;
    }

    // Special case for complex, directly imported components that don't need compilation.
    if (tool.name === 'Debug Log View') {
        return DebugLogView;
    }

    const code = tool.implementationCode || '';
    const sanitizedCode = code.replace(/export default .*;?/g, '');

    // Decouple component compilation from the live props object.
    // The list of props to destructure is derived from the tool's static definition.
    // This makes the compiled function stable across renders.
    const propKeys = tool.parameters?.map(p => p.name) || [];

    const componentSource = `(props) => {
      const { ${propKeys.join(', ')} } = props;
      ${sanitizedCode}
    }`;

    try {
      const { code: transformedCode } = Babel.transform(componentSource, {
        presets: ['react']
      });
      
      const iconNames = Object.keys(Icons);
      const iconComponents = Object.values(Icons);
      
      const componentFactory = new Function('React', 'UIToolRunner', ...iconNames, `return ${transformedCode}`);
      return componentFactory(React, UIToolRunner, ...iconComponents);

    } catch (e) {
      console.error(`Error compiling UI tool '${tool.name}':`, e);
      console.error('Offending code:', tool.implementationCode);
      return () => (
        <div className="p-4 bg-red-900/50 border-2 border-dashed border-red-500 rounded-lg text-red-300">
          <p className="font-bold">UI Compilation Error in "{tool.name}" (v{tool.version})</p>
          <pre className="mt-2 text-xs whitespace-pre-wrap">{e instanceof Error ? e.message : String(e)}</pre>
        </div>
      );
    }
  // The dependencies ensure re-compilation only happens if the tool's definition changes.
  // Using tool.id and tool.version is sufficient to detect tool updates.
  }, [tool.id, tool.version]);


  const fallback = (
    <div className="p-4 bg-yellow-900/50 border-2 border-dashed border-yellow-500 rounded-lg text-yellow-300">
      <p className="font-bold">UI Runtime Error in "{tool.name}" (v{tool.version})</p>
      <p className="text-sm">The component failed to render. Check console for details.</p>
    </div>
  );

  return (
    <ErrorBoundary fallback={fallback} toolName={tool.name}>
        <CompiledComponent {...props} />
    </ErrorBoundary>
  );
};

export default UIToolRunner;