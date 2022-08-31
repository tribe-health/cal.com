import { useTranslation } from "next-i18next";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Controller,
  useFieldArray,
  UseFieldArrayAppend,
  UseFieldArrayRemove,
  useFormContext,
} from "react-hook-form";
import { GroupBase, Props } from "react-select";

import dayjs, { Dayjs, ConfigType } from "@calcom/dayjs";
import { classNames } from "@calcom/lib";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { weekdayNames } from "@calcom/lib/weekday";
import { TimeRange } from "@calcom/types/schedule";
import { Icon } from "@calcom/ui";
import Dropdown, { DropdownMenuContent, DropdownMenuTrigger } from "@calcom/ui/Dropdown";
import { Button, Select, Switch, Tooltip } from "@calcom/ui/v2";

import { defaultDayRange as DEFAULT_DAY_RANGE } from "@lib/availability";
import useMeQuery from "@lib/hooks/useMeQuery";

const Schedule = () => {
  const { i18n } = useLocale();
  const form = useFormContext();
  // const initialValue = form.getValues();
  const initialValue = form.watch();

  const copyAllPosition = (initialValue["schedule"] as Array<TimeRange[]>)?.findIndex(
    (item: TimeRange[]) => item.length > 0
  );

  return (
    <>
      {/* First iterate for each day */}
      {weekdayNames(i18n.language, 0, "short").map((weekday, num) => {
        const name = `schedule.${num}`;
        const copyAllShouldRender = copyAllPosition === num;
        return (
          <div className="mb-1 flex w-full flex-col px-2 py-1 sm:flex-row" key={weekday}>
            {/* Label & switch container */}
            <div className="flex justify-between">
              <div>
                <label className="flex flex-row items-center">
                  <Switch
                    defaultChecked={initialValue["schedule"][num].length > 0}
                    checked={!!initialValue["schedule"][num].length}
                    onCheckedChange={(isChecked) => {
                      form.setValue(name, isChecked ? [DEFAULT_DAY_RANGE] : []);
                    }}
                  />
                  <span className="min-w-7 inline-block text-sm capitalize">{weekday}</span>
                </label>
              </div>
              <div className="inline sm:hidden">
                <ActionButtons
                  name={name}
                  setValue={form.setValue}
                  watcher={form.watch(name, initialValue[name])}
                  copyAllShouldRender={copyAllShouldRender}
                />
              </div>
            </div>
            <div className="sm:ml-10">
              <DayRanges name={name} copyAllShouldRender={copyAllShouldRender} />
            </div>
            <div className="my-2 h-[1px] w-full bg-gray-200 sm:hidden" />
          </div>
        );
      })}
    </>
  );
};

const DayRanges = ({
  name,
  defaultValue = [DEFAULT_DAY_RANGE],
  copyAllShouldRender,
}: {
  name: string;
  defaultValue?: TimeRange[];
  copyAllShouldRender?: boolean;
}) => {
  const form = useFormContext();

  // const fields = form.getValues(`${name}` as `schedule.0`);
  const fields = form.watch(`${name}` as `schedule.0`);
  // const { fields: fieldsWatch } = useFieldArray({
  //   name,
  // });

  const { replace, remove } = useFieldArray({
    name,
  });
  // console.log("fields render", { fields });
  // useEffect(() => {
  //   if (defaultValue.length && !fields.length) {
  //     replace(defaultValue);
  //   }
  // }, [replace, defaultValue, fields.length]);
  return (
    <div>
      {fields.map((field: { id: string }, index: number) => (
        <div key={field.id} className="mb-2 flex rtl:space-x-reverse">
          <TimeRangeField name={`${name}.${index}`} />
          {index === 0 && (
            <div className="hidden sm:inline">
              <ActionButtons
                name={name}
                setValue={form.setValue}
                watcher={form.watch(name)}
                copyAllShouldRender={copyAllShouldRender}
              />
            </div>
          )}
          {index !== 0 && <RemoveTimeButton index={index} remove={remove} />}
        </div>
      ))}
    </div>
  );
};

const RemoveTimeButton = ({
  index,
  remove,
  className,
}: {
  index: number | number[];
  remove: UseFieldArrayRemove;
  className?: string;
}) => {
  return (
    <Button
      type="button"
      size="icon"
      color="minimal"
      StartIcon={Icon.FiTrash}
      onClick={() => remove(index)}
      className={className}
    />
  );
};

interface TimeRangeFieldProps {
  name: string;
  className?: string;
}

const TimeRangeField = ({ name, className }: TimeRangeFieldProps) => {
  const { watch } = useFormContext();

  const values = watch(name);
  const minEnd = values["start"];
  const maxStart = values["end"];

  return (
    <div className={classNames("mx-1 flex", className)}>
      <Controller
        name={`${name}.start`}
        render={({ field: { onChange, value } }) => {
          return (
            <LazySelect
              className="w-[100px]"
              value={values["start"]}
              max={maxStart}
              onChange={(option) => {
                onChange(new Date(option?.value as number));
              }}
            />
          );
        }}
      />
      <span className="mx-2 self-center"> - </span>
      <Controller
        name={`${name}.end`}
        render={({ field: { onChange, value } }) => (
          <LazySelect
            className="w-[100px] rounded-md"
            value={values["end"]}
            min={minEnd}
            onChange={(option) => {
              onChange(new Date(option?.value as number));
            }}
          />
        )}
      />
    </div>
  );
};

const LazySelect = ({
  value,
  min,
  max,
  ...props
}: Omit<Props<Option, false, GroupBase<Option>>, "value"> & {
  value: ConfigType;
  min?: ConfigType;
  max?: ConfigType;
}) => {
  // Lazy-loaded options, otherwise adding a field has a noticeable redraw delay.
  const { options, filter } = useOptions();

  useEffect(() => {
    filter({ current: value });
  }, [filter, value]);

  return (
    <Select
      options={options}
      onMenuOpen={() => {
        if (min) filter({ offset: min });
        if (max) filter({ limit: max });
      }}
      value={options.find((option) => option.value === dayjs(value).toDate().valueOf())}
      onMenuClose={() => filter({ current: value })}
      components={{ DropdownIndicator: () => null, IndicatorSeparator: () => null }}
      {...props}
    />
  );
};

interface IOption {
  readonly label: string;
  readonly value: number;
}

/**
 * Creates an array of times on a 15 minute interval from
 * 00:00:00 (Start of day) to
 * 23:45:00 (End of day with enough time for 15 min booking)
 */
/** Begin Time Increments For Select */
const INCREMENT = 15;
const useOptions = () => {
  // Get user so we can determine 12/24 hour format preferences
  const query = useMeQuery();
  const { timeFormat } = query.data || { timeFormat: null };

  const [filteredOptions, setFilteredOptions] = useState<IOption[]>([]);

  const options = useMemo(() => {
    const end = dayjs().utc().endOf("day");
    let t: Dayjs = dayjs().utc().startOf("day");

    const options: IOption[] = [];
    while (t.isBefore(end)) {
      options.push({
        value: t.toDate().valueOf(),
        label: dayjs(t)
          .utc()
          .format(timeFormat === 12 ? "h:mma" : "HH:mm"),
      });
      t = t.add(INCREMENT, "minutes");
    }
    return options;
  }, [timeFormat]);

  const filter = useCallback(
    ({ offset, limit, current }: { offset?: ConfigType; limit?: ConfigType; current?: ConfigType }) => {
      if (current) {
        const currentOption = options.find((option) => option.value === dayjs(current).toDate().valueOf());
        if (currentOption) setFilteredOptions([currentOption]);
      } else
        setFilteredOptions(
          options.filter((option) => {
            const time = dayjs(option.value);
            return (!limit || time.isBefore(limit)) && (!offset || time.isAfter(offset));
          })
        );
    },
    [options]
  );

  return { options: filteredOptions, filter };
};

const ActionButtons = ({
  name,
  watcher,
  setValue,
  copyAllShouldRender,
}: {
  name: string;
  watcher: TimeRange[];
  setValue: (key: string, value: TimeRange[]) => void;
  copyAllShouldRender?: boolean;
}) => {
  const { t } = useTranslation();
  const form = useFormContext();
  // const values = form.getValues();
  // const fields = form.getValues(name);
  const values = form.watch();
  const { append } = useFieldArray({
    name,
  });

  return (
    <div className="flex items-center">
      <Tooltip content={t("add_time_availability") as string}>
        <Button
          className="text-neutral-400"
          type="button"
          color="minimal"
          size="icon"
          StartIcon={Icon.FiPlus}
          onClick={() => {
            handleAppend({ fields: watcher, append });
          }}
        />
      </Tooltip>
      <Dropdown>
        <Tooltip content={t("duplicate") as string}>
          <DropdownMenuTrigger asChild>
            <Button type="button" color="minimal" size="icon" StartIcon={Icon.FiCopy} />
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent>
          <CopyTimes
            disabled={[parseInt(name.substring(name.lastIndexOf(".") + 1), 10)]}
            onApply={(selected) =>
              selected.forEach((day) => {
                // TODO: Figure out why this is different?
                setValue(name.substring(0, name.lastIndexOf(".") + 1) + day, watcher);
              })
            }
          />
        </DropdownMenuContent>
      </Dropdown>
      {/* This only displays on Desktop  */}
      {copyAllShouldRender && (
        <Tooltip content={t("add_time_availability") as string}>
          <Button
            className="text-small w-fit px-1 text-neutral-400 sm:text-sm"
            color="minimal"
            size="icon"
            type="button"
            onClick={() => {
              // console.log({ values });
              values["schedule"].forEach((item: TimeRange[], index: number) => {
                if (item.length > 0) {
                  setValue(`schedule.${index}`, watcher);
                }
              });
            }}
            title="Copy All">
            Copy All
          </Button>
        </Tooltip>
      )}
    </div>
  );
};

const handleAppend = ({
  fields = [],
  append,
}: {
  fields: TimeRange[];
  append: UseFieldArrayAppend<TimeRange>;
}) => {
  if (fields.length === 0) {
    return append(DEFAULT_DAY_RANGE);
  }
  const nextRangeStart = dayjs((fields[fields.length - 1] as unknown as TimeRange).end);
  const nextRangeEnd = dayjs(nextRangeStart).add(1, "hour");

  if (nextRangeEnd.isBefore(nextRangeStart.endOf("day"))) {
    return append({
      start: nextRangeStart.toDate(),
      end: nextRangeEnd.toDate(),
    });
  }
};

const CopyTimes = ({ disabled, onApply }: { disabled: number[]; onApply: (selected: number[]) => void }) => {
  const [selected, setSelected] = useState<number[]>([]);
  const { i18n, t } = useLocale();
  // console.log("render");
  return (
    <div className="m-4 space-y-2 py-4">
      <p className="h6 text-xs font-medium uppercase text-neutral-400">Copy times to</p>
      <ol className="space-y-2">
        {weekdayNames(i18n.language).map((weekday, num) => (
          <li key={weekday}>
            <label className="flex w-full items-center justify-between">
              <span className="px-1">{weekday}</span>
              <input
                value={num}
                defaultChecked={disabled.includes(num)}
                disabled={disabled.includes(num)}
                onChange={(e) => {
                  if (e.target.checked && !selected.includes(num)) {
                    setSelected(selected.concat([num]));
                  } else if (!e.target.checked && selected.includes(num)) {
                    setSelected(selected.slice(selected.indexOf(num), 1));
                  }
                }}
                type="checkbox"
                className="inline-block rounded-[4px] border-gray-300 text-neutral-900 focus:ring-neutral-500 disabled:text-neutral-400"
              />
            </label>
          </li>
        ))}
      </ol>
      <div className="pt-2">
        <Button className="w-full justify-center" color="primary" onClick={() => onApply(selected)}>
          {t("apply")}
        </Button>
      </div>
    </div>
  );
};

export default Schedule;