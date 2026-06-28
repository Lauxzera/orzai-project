"use client";

import * as React from "react";
import type { DashboardProps, FloatingMarker } from "@/features/dashboard/lib/dashboard-types";

type HookProps = Pick<
  DashboardProps,
  "originData" | "courseData" | "taskOwnerData" | "periodLeads" | "pendingTaskItems" | "allLeads" | "trendData"
>;

export function useDashboardView({
  originData,
  courseData,
  taskOwnerData,
  periodLeads,
  pendingTaskItems,
  allLeads,
  trendData,
}: HookProps) {
  const [selectedOrigin, setSelectedOrigin] = React.useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = React.useState<string | null>(null);
  const [selectedTaskOwner, setSelectedTaskOwner] = React.useState<string | null>(null);
  const [darkMode, setDarkMode] = React.useState(false);

  React.useEffect(() => {
    const updateTheme = () => setDarkMode(document.documentElement.classList.contains("dark"));
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!originData.length) {
      setSelectedOrigin(null);
      return;
    }

    if (selectedOrigin && !originData.some((item) => item.name === selectedOrigin)) {
      setSelectedOrigin(null);
    }
  }, [originData, selectedOrigin]);

  React.useEffect(() => {
    if (!courseData.length) {
      setSelectedCourse(null);
      return;
    }

    if (selectedCourse && !courseData.some((item) => item.name === selectedCourse)) {
      setSelectedCourse(null);
    }
  }, [courseData, selectedCourse]);

  React.useEffect(() => {
    if (!taskOwnerData.length) {
      setSelectedTaskOwner(null);
      return;
    }

    if (selectedTaskOwner && !taskOwnerData.some((item) => item.name === selectedTaskOwner)) {
      setSelectedTaskOwner(null);
    }
  }, [selectedTaskOwner, taskOwnerData]);

  const selectedOriginIndex = originData.findIndex((item) => item.name === selectedOrigin);
  const selectedOriginValue = selectedOriginIndex >= 0 ?originData[selectedOriginIndex].value : 0;
  const selectedOriginLeads = selectedOrigin ?periodLeads.filter((lead) => lead.origem === selectedOrigin) : [];
  const selectedOriginShare = periodLeads.length ?Math.round((selectedOriginValue / periodLeads.length) * 100) : 0;

  const selectedOriginCourses = React.useMemo(
    () =>
      Object.entries(
        selectedOriginLeads.reduce<Record<string, number>>((acc, lead) => {
          acc[lead.curso_de_interesse] = (acc[lead.curso_de_interesse] || 0) + 1;
          return acc;
        }, {}),
      ).sort((a, b) => b[1] - a[1]),
    [selectedOriginLeads],
  );

  const selectedOriginOwners = React.useMemo(
    () =>
      Object.entries(
        selectedOriginLeads.reduce<Record<string, number>>((acc, lead) => {
          acc[lead.responsavel] = (acc[lead.responsavel] || 0) + 1;
          return acc;
        }, {}),
      ).sort((a, b) => b[1] - a[1]),
    [selectedOriginLeads],
  );

  const peakLeadIndex = Math.max(
    0,
    trendData.reduce((best, item, index) => (item.leads > trendData[best]?.leads ?index : best), 0),
  );
  const peakEnrollmentIndex = Math.max(
    0,
    trendData.reduce((best, item, index) => (item.matriculas > trendData[best]?.matriculas ?index : best), 0),
  );

  const chartMarkers: FloatingMarker[] = [
    {
      dataKey: "leads",
      label: "Leads",
      value: trendData[peakLeadIndex]?.leads ?? 0,
      x: trendData[peakLeadIndex]?.label ?? "",
      color: "var(--chart-1)",
    },
    {
      dataKey: "matriculas",
      label: "Matrículas",
      value: trendData[peakEnrollmentIndex]?.matriculas ?? 0,
      x: trendData[peakEnrollmentIndex]?.label ?? "",
      color: "var(--chart-2)",
    },
  ];

  const selectedOwnerTasks = selectedTaskOwner
    ? pendingTaskItems.filter((task) => task.owner === selectedTaskOwner && !task.done)
    : [];

  const selectedCourseLeads = selectedCourse
    ? periodLeads.filter((lead) => lead.curso_de_interesse === selectedCourse)
    : [];

  const leadNameById = React.useMemo(
    () =>
      allLeads.reduce<Record<string, string>>((acc, lead) => {
        acc[lead.id] = lead.nome;
        return acc;
      }, {}),
    [allLeads],
  );

  return {
    state: {
      selectedOrigin,
      selectedCourse,
      selectedTaskOwner,
      darkMode,
      selectedOriginIndex,
      selectedOriginValue,
      selectedOriginLeads,
      selectedOriginShare,
      selectedOriginCourses,
      selectedOriginOwners,
      chartMarkers,
      selectedOwnerTasks,
      selectedCourseLeads,
      leadNameById,
    },
    actions: {
      setSelectedOrigin,
      setSelectedCourse,
      setSelectedTaskOwner,
    },
  };
}
