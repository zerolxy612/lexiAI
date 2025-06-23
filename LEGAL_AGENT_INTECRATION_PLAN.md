# Legal Contract Reviewer Agent Integration Plan

This document outlines the steps to integrate a new "Legal Contract Reviewer" agent into the Refly application.

## 1. Feature Overview

The goal is to add a new feature that allows users to get an AI-powered review of legal contracts. The user will select the contract text, right-click, and choose a new "Legal Contract Review" option from the context menu. The feature will use an external agent provided by Dify.

- **API Endpoint:** `https://api.dify.ai/v1`
- **App ID:** `app-6KYmzKxZCLvoKMMh3VnrgFMs`

The agent is expected to analyze the text and provide feedback, including identified risks, suggestions for modifications, and legal justifications, similar to the example provided in `HKGAI配置与前端交互流程.md`.

## 2. User Flow

1.  The user selects a block of text within a document in the web application.
2.  The user right-clicks on the selection to open the context menu.
3.  The user clicks on the "Legal Contract Review" option in the menu.
4.  The application sends the selected text to the backend for analysis.
5.  A new panel, similar to the "Deep Research" panel, opens to display the streaming results from the agent.
6.  The panel will show the analysis, including potential issues, risk levels, and suggested modifications. The final output might be an HTML-annotated document.

## 3. Implementation Steps

### Phase 1: Frontend - Context Menu (Current Task)

1.  **Locate Context Menu Component:** Identify the React component responsible for rendering the right-click context menu. This is likely a shared component in `packages/ai-workspace-common`.
2.  **Add New Menu Item:** Add a "Legal Contract Review" item to the menu's configuration.
    -   Assign an appropriate icon.
    -   The initial action handler will be a placeholder (e.g., `console.log`).

### Phase 2: Backend - API Endpoint

1.  **Create a New Module/Service:** In the `apps/api` project, create a new module for the contract review feature (e.g., `legal-review`).
2.  **Create DTOs:** Define Data Transfer Objects for the request (containing the contract text) and response.
3.  **Implement Controller:** Create a new controller with an endpoint (e.g., `/api/v1/legal-review/stream`).
4.  **Implement Service:** The service will handle the business logic:
    -   Receive the text from the controller.
    -   Make a streaming request to the Dify API endpoint.
    -   Stream the response back to the client.
    -   Handle authentication and errors.

### Phase 3: Frontend - UI for Results

1.  **Create Result Panel Component:** Create a new React component, `LegalReviewPanel.tsx`, to display the results.
    -   This component can be based on `DeepResearchPanel.tsx` to handle streaming data and display stages of analysis.
    -   It should be able to render the final HTML-annotated document.
2.  **State Management:** Use Zustand or another state management solution to manage the panel's state (is open, query text, results, etc.).
3.  **Connect UI to API:** Update the context menu item's action handler to:
    -   Open the `LegalReviewPanel`.
    -   Trigger the API call to the backend.

### Phase 4: Integration and Testing

1.  **E2E Testing:** Write end-to-end tests to simulate the full user flow.
2.  **Unit/Integration Testing:** Add tests for the new backend and frontend components.
3.  **Refinement:** Refine the UI and error handling based on testing. 