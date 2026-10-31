import { Component } from "react";
import HttpErrorPage from "@/pages/HttpErrorPage";

class AppErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, details) {
    console.error("An unexpected application error occurred.", error, details);
  }

  render() {
    if (this.state.hasError) {
      return <HttpErrorPage status={500} />;
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
