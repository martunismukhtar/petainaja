/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { AppView } from "./components/AppView";
import { useAppLogic } from "./hooks/useAppLogic";

export default function App() {
  const logicProps = useAppLogic();

  return <AppView {...logicProps} />;
}
