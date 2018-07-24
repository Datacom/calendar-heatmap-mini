if (typeof define === 'function' && define.amd) {
  define(['d3-array', 'd3-scale', 'd3-selection', 'd3-time', 'd3-time-format'], function () {
    'use strict';

    return calendarHeatmapMini;
  });
} else if (typeof module === 'object' && module.exports) {
  module.exports = calendarHeatmapMini;
} else {
  window.CalendarHeatMapMini = calendarHeatmapMini;
}

var d3 = typeof require === 'function' ? Object.assign({},
  require('d3-array'),
  require('d3-scale'),
  require('d3-selection'),
  require('d3-time'),
  require('d3-time-format')) : window.d3;

function calendarHeatmapMini() {
  // defaults
  var selector = 'body';
  var SQUARE_LENGTH = 12;
  var SQUARE_PADDING = 3;
  var MONTH_LABEL_PADDING = 10;
  var now = d3.timeDay.ceil(new Date());
  var yearAgo = d3.timeDay.offset(d3.timeYear.offset(now, -1), -1);
  var data = [];
  var max = null;
  var colorRange = ['#D8E6E7', '#218380'];
  var tooltipEnabled = true;
  var tooltipUnit = 'Event';
  var legendEnabled = true;
  var singleSelection = true;
  var onClick = null;
  var dateFormat = d3.timeFormat('%d-%m-%Y');
  var splitMonths = false;
  var tooltipText = function tooltipText(d) {
    var dateStr = dateFormat(d);
    var count = countForDate(d);
    return (count ? count.toLocaleString() : locale.No) + ' ' + pluralizedTooltipUnit(count) + ' ' + locale.on + ' ' + dateStr;
  };
  var weekStart = 0; //0 for Sunday, 1 for Monday
  var locale = {
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    days: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    No: 'No',
    on: 'on',
    Less: 'Less',
    More: 'More'
  };

  // setters and getters
  chart.data = function (value) {
    if (!arguments.length) { return data; }
    data = value;
    return chart;
  };

  chart.splitMonths = function (value) {
    if (!arguments.length) { return splitMonths; }
    splitMonths = value;
    return chart;
  };

  chart.dateFormat = function (value) {
    if (!arguments.length) { return dateFormat; }
    dateFormat = value;
    return chart;
  };

  chart.max = function (value) {
    if (!arguments.length) { return max; }
    max = value;
    return chart;
  };

  chart.selector = function (value) {
    if (!arguments.length) { return selector; }
    selector = value;
    return chart;
  };

  chart.select = function(s) {
    return d3.select(chart.selector()).select(s);
  }
  chart.selectAll = function(s) {
    return d3.select(chart.selector()).selectAll(s);
  }

  chart.startDate = function (value) {
    if (!arguments.length) { return yearAgo; }
    yearAgo = value;
    now = d3.timeYear.offset(value, 1);
    return chart;
  };

  chart.endDate = function() {
    return now;
  }

  chart.colorRange = function (value) {
    if (!arguments.length) { return colorRange; }
    colorRange = value;
    return chart;
  };

  chart.tooltipEnabled = function (value) {
    if (!arguments.length) { return tooltipEnabled; }
    tooltipEnabled = value;
    return chart;
  };

  chart.tooltipUnit = function (value) {
    if (!arguments.length) { return tooltipUnit; }
    tooltipUnit = value;
    return chart;
  };

  chart.legendEnabled = function (value) {
    if (!arguments.length) { return legendEnabled; }
    legendEnabled = value;
    return chart;
  };

  chart.onClick = function (value) {
    if (!arguments.length) { return onClick(); }
    onClick = value;
    return chart;
  };

  chart.tooltipText = function (value) {
    if (!arguments.length) { return tooltipText; }
    tooltipText = value;
    return chart;
  };

  chart.singleSelection = function (value) {
    if (!arguments.length) { return singleSelection; }
    singleSelection = value;
    return chart;
  };

  chart.locale = function (value) {
    if (!arguments.length) { return locale; }
    locale = value;
    return chart;
  };

  function chart() {

    d3.select(chart.selector()).selectAll('svg.calendar-heatmap-mini').remove(); // remove the existing chart, if it exists

    var dateRange = d3.timeDays(yearAgo, now); // generates an array of date objects within the specified range
    var monthRange = d3.timeMonths(d3.timeMonth.floor(yearAgo), now); // it ignores the first month if the 1st date is after the start of the month
    var firstDate = dateRange[0];
    // initialize data with 0 counts if there is none
    if (chart.data().length === 0) {
      var chartData = d3.timeDays(yearAgo, now).map(function (dateElement) {
        return { date: dateElement, count: 0 };
      });
      chart.data(chartData);
    }

    max = d3.max(chart.data(), function (d) { return d.count; });

    // color range
    var color = d3.scaleLinear()
      .range(chart.colorRange())
      .domain([0, max]);

    var dayRects;

    drawChart();

    function drawChart() {
      var svg = d3.select(chart.selector())
        .style('position', 'relative')
        .append('svg')
        .attr('class', 'calendar-heatmap-mini')
        .attr('viewBox', splitMonths ?
          (legendEnabled ? '-15 -15 1005 160' : '-15 -15 1005 135') :
          (legendEnabled ? '-15 -15 825 160' : '-15 -15 825 135')
        )

      dayRects = svg.selectAll('.day-cell')
        .data(dateRange); // array of days for the last yr

      dayRects.enter()
        .append('rect')
        .attr('class', 'day-cell')
        .attr('width', SQUARE_LENGTH)
        .attr('height', SQUARE_LENGTH)
        .attr('fill', function (d) { return color(countForDate(d)); })
        .attr('x', function (d, i) {
          var weekFromStart = d3.timeWeek.count(firstDate, d)
          if(splitMonths) {
            weekFromStart += d3.timeMonth.count(firstDate, d);
          }

          return weekFromStart * (SQUARE_LENGTH + SQUARE_PADDING);
        })
        .attr('y', function (d, i) {
          return MONTH_LABEL_PADDING + formatWeekday(d.getDay()) * (SQUARE_LENGTH + SQUARE_PADDING);
        })
        .each(function (d, i, g) {
          var dayRect = d3.select(this);
          var selectedDay;
          var dummyTooltip;
          var tooltip;

          if (typeof onClick === 'function') {
            dayRect.on('click', function (d) {

              if (chart.singleSelection()) {
                // Unselect any previously selected boxes
                d3.select(chart.selector()).selectAll(".day-cell").style('stroke', null);
              }

              if (selectedDay) {
                selectedDay.style('stroke', null);
              }

              selectedDay = dayRect;
              selectedDay.style('stroke', 'rgb(0,0,0)');

              var count = countForDate(d);
              onClick({ date: d, count: count });
            });
          }

          if (chart.tooltipEnabled()) {
            dayRect
              .on('mouseover', function (d, i) {
                var x = parseInt(this.getAttribute('x'));
                var y = parseInt(this.getAttribute('y')) - SQUARE_PADDING;
                var tooltipLabel = chart.tooltipText()(d);

                // append an invisible svg text element for pre-calculating width
                dummyTooltip = svg.append('text')
                    .attr('class', 'day-cell-tooltip')
                    .style('visibility', 'hidden')
                    .text(tooltipLabel);

                var tooltipBBox = dummyTooltip.node().getBBox();
                var svgBBox = svg.node().getBBox();

                tooltip = svg.append('g');

                tooltip.append('rect')
                  .attr('fill', chart.colorRange()[0])
                  .attr('rx', '2')
                  .attr('ry', '2')
                  .attr('height', tooltipBBox.height + (SQUARE_PADDING * 2))
                  .attr('width', tooltipBBox.width + (SQUARE_PADDING * 2))
                  .attr('x', function () {
                    var spaceTaken = x + tooltipBBox.width;
                    if (spaceTaken > svgBBox.width) {
                      return x - (spaceTaken - svgBBox.width) - SQUARE_PADDING;
                    }
                    return x;
                  })
                  .attr('y', y - 12)
                  .style('stroke-width', '1')
                  .style('stroke', chart.colorRange()[1]);

                tooltip.append('text')
                  .attr('class', 'day-cell-tooltip')
                  .attr('fill', 'black')
                  .attr('height', tooltipBBox.height)
                  .attr('width', tooltipBBox.width)
                  .attr('x', function () {
                    var spaceTaken = x + tooltipBBox.width;
                    if (spaceTaken > svgBBox.width) {
                      return x - (spaceTaken - svgBBox.width);
                    }
                    return x + SQUARE_PADDING;
                  })
                  .attr('y', y)
                  .text(tooltipLabel);
              })
              .on('mouseout', function (d, i) {
                dummyTooltip.remove();
                tooltip.remove();
              });
          }
        });

      if (chart.legendEnabled()) {
        var colorRange = [color(0)];
        for (var i = 3; i > 0; i--) {
          colorRange.push(color(max / i));
        }

        var svgBBox = svg.node().getBBox();
        var width = svgBBox.width;
        var height = svgBBox.height + (SQUARE_PADDING * 7);
        var legendWidth = (SQUARE_LENGTH + SQUARE_PADDING) * 7;

        var legendGroup = svg.append('g');
        legendGroup.selectAll('.calendar-heatmap-mini-legend')
          .data(colorRange)
          .enter()
          .append('rect')
          .attr('class', 'calendar-heatmap-mini-legend')
          .attr('width', SQUARE_LENGTH)
          .attr('height', SQUARE_LENGTH)
          .attr('x', function (d, i) { return (width - legendWidth) + (i + 1) * 13; })
          .attr('y', height + SQUARE_PADDING)
          .attr('fill', function (d) { return d; });

        legendGroup.append('text')
          .attr('class', 'calendar-heatmap-mini-legend-text calendar-heatmap-mini-legend-text-less')
          .attr('x', width - legendWidth - 20)
          .attr('y', height + SQUARE_LENGTH)
          .text(locale.Less);

        legendGroup.append('text')
          .attr('class', 'calendar-heatmap-mini-legend-text calendar-heatmap-mini-legend-text-more')
          .attr('x', (width - legendWidth + SQUARE_PADDING) + (colorRange.length + 1) * 13)
          .attr('y', height + SQUARE_LENGTH)
          .text(locale.More);
      }

      dayRects.exit().remove();
      var dateStringRange = dateRange.map(d => d.toDateString());
      var monthLabels = svg.selectAll('.month')
        .data(monthRange)
        .enter()
        .append('text')
        .attr('class', 'month-name')
        .attr('x', function (d, i) {
          var matchIndex = dateStringRange.indexOf(d.toDateString()) + 1;
          var col = Math.floor((matchIndex + firstDate.getDay() - 1) / 7);
          if(splitMonths) {
            col += d3.timeMonth.count(firstDate, d);
          }
          return col * (SQUARE_LENGTH + SQUARE_PADDING);
        })
        .attr('y', 0)  // fix these to the top
        .text(function (d) {
          return locale.months[d.getMonth()];
        });

      locale.days.forEach(function (day, index) {
        index = formatWeekday(index);
        if (index % 2) {
          svg.append('text')
            .attr('class', 'day-initial')
            .attr('transform', 'translate(-8,' + (SQUARE_LENGTH + SQUARE_PADDING) * (index + 1) + ')')
            .style('text-anchor', 'middle')
            .attr('dy', '2')
            .text(day);
        }
      });
    }

    function formatWeekday(weekDay) {
      if (weekStart === 1) {
        if (weekDay === 0) {
          return 6;
        } else {
          return weekDay - 1;
        }
      }
      return weekDay;
    }

    var daysOfChart = chart.data().map(function (day) {
      return day.date.toDateString();
    });

    dayRects.filter(function (d) {
      return daysOfChart.indexOf(d.toDateString()) > -1;
    }).attr('fill', function (d, i) {
      return color(chart.data()[i].count);
    });
  }

  function countForDate(d) {
    var count = 0;
    var match = chart.data().find(function (element, index) {
      return d3.timeDay.floor(d).getTime() == d3.timeDay.floor(element.date).getTime();
    });
    if (match) {
      count = match.count;
    }
    return count;
  }

  function pluralizedTooltipUnit(count) {
    if ('string' === typeof tooltipUnit) {
      return (tooltipUnit + (count === 1 ? '' : 's'));
    }
    for (var i in tooltipUnit) {
      var _rule = tooltipUnit[i];
      var _min = _rule.min;
      var _max = _rule.max || _rule.min;
      _max = _max === 'Infinity' ? Infinity : _max;
      if (count >= _min && count <= _max) {
        return _rule.unit;
      }
    }
  }

  return chart;
}


// polyfill for Array.find() method
/* jshint ignore:start */
if (!Array.prototype.find) {
  Array.prototype.find = function (predicate) {
    if (this === null) {
      throw new TypeError('Array.prototype.find called on null or undefined');
    }
    if (typeof predicate !== 'function') {
      throw new TypeError('predicate must be a function');
    }
    var list = Object(this);
    var length = list.length >>> 0;
    var thisArg = arguments[1];
    var value;

    for (var i = 0; i < length; i++) {
      value = list[i];
      if (predicate.call(thisArg, value, i, list)) {
        return value;
      }
    }
    return undefined;
  };
}
/* jshint ignore:end */
