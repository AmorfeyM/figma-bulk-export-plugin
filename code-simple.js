// Простая версия плагина без TypeScript
figma.showUI(__html__, {
  width: 400,
  height: 500,
  themeColors: true
});

// Функция для поиска всех секций и их фреймов
function findSectionsAndFrames() {
  const sections = [];

  // Функция для рекурсивного поиска в узлах
  function searchInNode(node) {
    if (node.type === 'SECTION') {
      const frames = [];

      // Ищем все фреймы внутри секции
      function findFramesInNode(childNode) {
        if (childNode.type === 'FRAME') {
          frames.push(childNode);
        } else if (childNode.children) {
          for (const grandChild of childNode.children) {
            findFramesInNode(grandChild);
          }
        }
      }

      for (const child of node.children) {
        findFramesInNode(child);
      }

      if (frames.length > 0) {
        sections.push({
          name: node.name,
          frames: frames
        });
      }
    } else if (node.children) {
      for (const child of node.children) {
        searchInNode(child);
      }
    }
  }

  // Ищем секции на всех страницах
  for (const page of figma.root.children) {
    if (page.type === 'PAGE') {
      for (const child of page.children) {
        searchInNode(child);
      }
    }
  }

  return sections;
}

// Функция для экспорта фрейма в байты
async function exportFrameToBytes(frame, settings) {
  let exportSettings;

  if (settings.format === 'SVG') {
    exportSettings = {
      format: 'SVG'
    };
  } else {
    exportSettings = {
      format: settings.format,
      constraint: {
        type: 'SCALE',
        value: settings.scale
      }
    };
  }

  return await frame.exportAsync(exportSettings);
}

// Обработчик сообщений от UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'get-sections') {
    const sections = findSectionsAndFrames();
    const sectionsInfo = sections.map(section => ({
      name: section.name,
      frameCount: section.frames.length
    }));

    figma.ui.postMessage({
      type: 'sections-found',
      sections: sectionsInfo
    });
  }

  if (msg.type === 'start-export') {
    const settings = msg.settings;
    const sections = findSectionsAndFrames();

    if (sections.length === 0) {
      figma.ui.postMessage({
        type: 'export-error',
        message: 'Секции с фреймами не найдены'
      });
      return;
    }

    let totalFrames = 0;
    sections.forEach(section => {
      totalFrames += section.frames.length;
    });

    let exportedFrames = 0;
    const exportedData = {};

    try {
      for (const section of sections) {
        exportedData[section.name] = {};

        for (const frame of section.frames) {
          const imageBytes = await exportFrameToBytes(frame, settings);
          exportedData[section.name][frame.name] = imageBytes;

          exportedFrames++;
          const progress = Math.round((exportedFrames / totalFrames) * 100);

          figma.ui.postMessage({
            type: 'export-progress',
            progress: progress,
            currentSection: section.name,
            currentFrame: frame.name
          });
        }
      }

      figma.ui.postMessage({
        type: 'export-complete',
        data: exportedData
      });

    } catch (error) {
      figma.ui.postMessage({
        type: 'export-error',
        message: 'Ошибка экспорта: ' + (error.message || 'Неизвестная ошибка')
      });
    }
  }

  if (msg.type === 'close-plugin') {
    figma.closePlugin();
  }
};
