"use client";

import { ArrowUpRight, ChevronDown } from "lucide-react";
import { usePortal } from "./portal-shell";
import FeatureIcon from "./feature-icon";

export default function WorkspaceDirectory() {
  const { groups } = usePortal();
  return (
    <section
      className="portal-directory"
      aria-labelledby="portal-directory-title"
    >
      <div className="portal-directory-heading">
        <div>
          <h2 id="portal-directory-title">Explore Your Workspace</h2>
          <p>Related tools, together. Choose a group to see its features.</p>
        </div>
      </div>
      <div className="portal-directory-grid">
        {groups
          .filter((group) => group.id !== "home")
          .map((group) => (
            <details className="portal-directory-group" key={group.id}>
              <summary>
                <span className="portal-group-icon">
                  <FeatureIcon name={group.icon} size={21} />
                </span>
                <span>
                  <strong>{group.label}</strong>
                  <small>
                    {group.items.length}{" "}
                    {group.items.length === 1 ? "feature" : "features"}
                  </small>
                </span>
                <ChevronDown size={16} />
              </summary>
              <p>{group.description}</p>
              <div>
                {group.items.map((item) => (
                  <a href={item.href} key={item.id}>
                    <span>{item.label}</span>
                    <ArrowUpRight size={14} />
                  </a>
                ))}
              </div>
            </details>
          ))}
      </div>
    </section>
  );
}
