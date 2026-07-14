"use client";

import type { ReactNode } from "react";
import Icon from "../Icon";

type PartnerPageHeaderProps = {
  title: string;
  subtitle?: string;
  onFilterClick?: () => void;
  actions?: ReactNode;
};

export default function PartnerPageHeader({
  title,
  subtitle,
  onFilterClick,
  actions
}: PartnerPageHeaderProps) {
  return (
    <div className="partner-page-header">
      <div className="page-header" style={{ marginBottom: 0 }}>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="partner-page-actions">
        {actions}
        {onFilterClick ? (
          <button type="button" className="btn btn-secondary partner-filter-btn" onClick={onFilterClick}>
            <Icon name="filter" className="w-4 h-4" />
            Data Filter
          </button>
        ) : null}
      </div>
    </div>
  );
}
