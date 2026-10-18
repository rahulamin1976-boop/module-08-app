import { Link } from "react-router-dom";
import PageState from "../components/PageState.jsx";

export default function NotFoundPage() {
  return (
    <>
      <PageState kind="error" title="Page not found">
        This route is not part of the reporting workflow.
      </PageState>
      <Link className="text-link" to="/">Return to weekly reports</Link>
    </>
  );
}
