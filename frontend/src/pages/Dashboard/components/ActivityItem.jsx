// src/pages/Dashboard/components/ActivityItem.jsx
import React from 'react';

const ActivityItem = ({ activity }) => {
  return (
    <div className="flex items-start gap-4 py-4">
      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{activity.title}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{activity.description}</p>
        {activity.user && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Por: {activity.user}</p>
        )}
        {activity.time && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{activity.time}</p>
        )}
      </div>
    </div>
  );
};

export default ActivityItem;