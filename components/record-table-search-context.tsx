"use client";

import { createContext, useContext } from "react";

/** Shared by the report toolbar and server-rendered table children. */
export const RecordTableSearchContext = createContext("");
export function useRecordTableSearch() { return useContext(RecordTableSearchContext); }
