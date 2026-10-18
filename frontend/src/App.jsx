import { BrowserRouter, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout.jsx";
import AtlassianConnectionPage from "./pages/AtlassianConnectionPage.jsx";
import CreateReportPage from "./pages/CreateReportPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import PublishReportPage from "./pages/PublishReportPage.jsx";
import ReviewReportPage from "./pages/ReviewReportPage.jsx";
import WeeklyReportsPage from "./pages/WeeklyReportsPage.jsx";

export function ApplicationRoutes() {
  return (
    <Routes>
      <Route path="/" element={<WeeklyReportsPage />} />
      <Route path="/reports/new" element={<CreateReportPage />} />
      <Route path="/reports/:reportId/review" element={<ReviewReportPage />} />
      <Route path="/reports/:reportId/publish" element={<PublishReportPage />} />
      <Route path="/connection" element={<AtlassianConnectionPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <ApplicationRoutes />
      </AppLayout>
    </BrowserRouter>
  );
}
