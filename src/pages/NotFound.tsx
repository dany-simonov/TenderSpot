import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: '#0F1117' }}
    >
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-3 mono" style={{ color: '#388BFD' }}>
          404
        </h1>
        <p className="text-base mb-6" style={{ color: '#8B949E' }}>
          Страница не найдена
        </p>
        <a
          href="/"
          className="text-sm px-4 py-2 rounded"
          style={{
            border: '1px solid #21262D',
            color: '#388BFD',
            borderRadius: '4px',
            textDecoration: 'none',
          }}
        >
          Вернуться на главную
        </a>
      </div>
    </div>
  );
};

export default NotFound;
