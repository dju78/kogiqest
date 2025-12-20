import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-900 text-white p-8 font-mono overflow-auto">
                    <h1 className="text-3xl text-red-500 font-bold mb-4">Something went wrong.</h1>
                    <div className="bg-black/50 p-4 rounded-lg border border-red-500/30">
                        <h2 className="text-xl text-red-300 mb-2">Error:</h2>
                        <pre className="whitespace-pre-wrap break-words text-sm">
                            {this.state.error && this.state.error.toString()}
                        </pre>
                    </div>
                    {this.state.errorInfo && (
                        <div className="mt-8">
                            <h2 className="text-xl text-slate-400 mb-2">Component Stack:</h2>
                            <pre className="text-xs text-slate-500 whitespace-pre-wrap">
                                {this.state.errorInfo.componentStack}
                            </pre>
                        </div>
                    )}
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-8 px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition-colors"
                    >
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
