已知有学生表.课程表.教师表和成绩表三张表，具体字段如下，写出要求的SQL

| 表名                               | 字段                                 |
| ---------------------------------- | ------------------------------------ |
| Student(s_id,s_name,s_birth,s_sex) | 学生编号,学生姓名, 出生年月,学生性别 |
| Course(c_id,c_name,t_id)           | 课程编号, 课程名称, 教师编号         |
| Teacher(t_id,t_name)               | 教师编号,教师姓名                    |
| Score(s_id,c_id,s_score)           | 学生编号,课程编号,分数               |

**心得总结**

1、当select子句中使用了聚合函数时，需使用group by进行分组；

2、如果使用了group by进行分组，并且要加条件只能使用having子句；

3、两者的关系：当一条含有having的sql语句时就一定要有group by的出现。

**1.查询课程编号为“01”的课程比“02”的课程成绩高的所有学生的学号**

```sql
select stu.s_id
from Student stu
inner join(select s_id,s_score from  Score where c_id='01') a on stu.s_id = a.s_id
inner join(select s_id,s_score from  Score where c_id='02') b on stu.s_id = b.s_id
where a.s_score > b.s_score
```

**2.查询平均成绩小于60分的学生的学号和平均成绩（包含无成绩的）**

```sql
select stu.s_id,avg(ifnull(sc.s_score,0)) as avg
from Student stu
left join Score sc
on stu.s_id = sc.s_id
group by stu.s_id
having
avg(sc.s_score) is null or avg(sc.s_score)<60
```

**5.查询没学过“张三”老师课的学生的学号.姓名（重点）**

```sql
select stu.s_id,stu.s_name
from Student stu
where stu.s_id not in(
  select sc.s_id from Score sc
  inner join Course co on sc.c_id = co.c_id
  inner join Teacher te on co.t_id = te.t_id
  where te.t_name = '张三'
)
GROUP BY stu.s_id
```

**7.查询学过编号为“01”的课程并且也学过编号为“02”的课程的学生的学号.姓名（重点）**

```sql
SELECT stu.s_id, stu.s_name
FROM Student stu
WHERE s_id in 
(
	SELECT a.s_id
	FROM (SELECT s_id,c_id FROM Score sc1 WHERE sc1.c_id = '01') a 
	INNER JOIN (SELECT s_id,c_id FROM Score sc2 WHERE sc2.c_id = '02') b 
	on a.s_id = b.s_id
)

```

**10.查询没有学全所有课的学生的学号.姓名(重点)**

注:

 1.最全的课程要从course中选择，而不是 score

 2.select可以没有和HAVING一样的聚合函数

思路：

1. 查找所有课程的总数
1. 查找学过的课程数小于所有课程数的学生信息

```sql
select stu.s_id,stu.s_name
from Student stu inner join Score sc on stu.s_id = sc.s_id
group by stu.s_id,stu.s_name
having count(c_id)<(select count(distinct c_id) from Course)
```

**11.查询至少有一门课与学号为“01”的学生所学课程相同的学生的学号和姓名（重点）**

思路：

1. 找到学号为“01”的学生所学课程
1. 找到所有学过至少一门（in）学号为“01”的学生所学课程 的学生
1. 去掉学号为”01“的学生

```sql
select distinct stu.s_id,stu.s_name
from Student stu inner join Score sc on stu.s_id = sc.s_id
where sc.c_id in
(select c_id from Score where s_id = '01') and stu.s_id!='01'
```

**12.查询和“01”号同学所学课程完全相同的其他同学的学号(重点)**

思路：

1. 查找01号同学所学的所有课程
1. 查找没学过01号同学学过的所有课程的学生的学号
1. 该学生学过的课程数等于01号同学学过的课程数

```sql
select s_id from Score
where s_id != '01'
and s_id not in 
(
	select s_id 
  from Score 
  where c_id not in 
  	( 
      select c_id 
      from Score 
      where s_id = '01'
    )
)
group by s_id
having count(*) = (select count(*) from Score where s_id = '01')
```

**13.查询没学过"张三"老师讲授的任一门课程的学生姓名 和47题一样（重点，能做出来）**

```sql
select s_name
from Student 
where s_id not in(
  select sc.s_id 
	from Score sc 
  inner join Course co on sc.c_id = co.c_id
  inner join Teacher te on co.t_id = te.t_id
  where te.t_name = '张三'
)
```

**15.查询两门及其以上不及格课程的同学的学号，姓名及其平均成绩（重点）**

```sql
select stu.s_id, stu.s_name, avg(sc.s_score)
from Student stu inner join Score sc on stu.s_id = sc.s_id
where not sc.s_score >=60
group by stu.s_id, stu.s_name
having count(c_id)>=2
```

**17.按平均成绩从高到低显示所有学生的所有课程的成绩以及平均成绩(重重点与35一样)**

```sql
select s_id,
max(case when c_id='02' then s_score else null end) '数学',
max(case when c_id='01' then s_score else null end) '语文',
max(case when c_id='03' then s_score else null end) '英语',
avg(s_score)
from Score group by s_id
order by avg(s_score) desc
```

**18.查询各科成绩最高分.最低分和平均分：以如下形式显示：课程ID，课程name，最高分，最低分，平均分，及格率，中等率，优良率，优秀率**

**--及格为>=60，中等为：70-80，优良为：80-90，优秀为：>=90 (超级重点)**

```sql
select sc.c_id,
			 co.c_name,
			 max(sc.s_score) '最高分', 
			 min(sc.s_score) '最低分', 
			 avg(sc.s_score) '平均分',
			 avg(case when sc.s_score>=60 then 1.0 else 0.0 end)'及格率',
			 avg(case when sc.s_score>=70 and sc.s_score<80 then 1.0 else 0.0 end)'中等率',
			 avg(case when sc.s_score>=80 and sc.s_score<90 then 1.0 else 0.0 end)'优良率',
			 avg(case when sc.s_score>=90 then 1.0 else 0.0 end)'优秀率'
from Score sc inner join Course co on sc.c_id = co.c_id
group by sc.c_id
```

**19.按各科成绩进行排序，并显示排名**

```sql
select s_id, s_score, row_number () over(order by s_score desc)
from Score
```

**22.查询所有课程的成绩第2名到第3名的学生信息及该课程成绩（重要 25类似）**

```sql
select *
from Score sc inner join Student stu on sc.s_id = stu.s_id
limit 2,3
```

**24.查询学生平均成绩及其名次（同19题，重点）**

```sql
select s_id,s_score, row_number() over(order by avg(s_score))
from Score
group by s_id
```

**31.查询1990年出生的学生名单（重点year）**

```sql
select *
from Student
where year(s_birth)=1990;
--或者
select *
from Student
where s_birth like '1990%';
```

**36.查询任何一门课程成绩在70分以上的姓名.课程名称和分数（重点）**

思路：

姓名说明要用到Student表，课程名称说明要用到Course表，分数说明要用到Score表

```sql
select stu.s_name, co.c_name, sc.s_score
from Course co 
inner join Score sc on co.c_id = sc.c_id
inner join Student stu on sc.s_id = stu.s_id 
where stu.s_id in
(
		select distinct s_id from Score
  	where s_id not in (select distinct s_id from Score where s_score < 70)
)
```

**40.查询选修“张三”老师所授课程的学生中成绩最高的学生姓名及其成绩**

```sql
select s_name,s_score
from Score sc 
inner join Course co on sc.c_id = co.c_id
inner join Student stu on sc.s_id = stu.s_id
inner join Teacher te on co.t_id = te.t_id
where te.t_name='张三'
order by sc.s_score desc
limit 1
```



**41.查询不同课程成绩相同的学生的学生编号.课程编号.学生成绩 （重点）**

```sql
select s_id,c_id,s_score
from Score s1
where s_id in(
select s_id from Score s2 where s2.s_id=s1.s_id and s1.s_score = s2.s_score and s1.c_id<>s2.c_id
);
```

**45. 查询选修了全部课程的学生信息**

```sql
select s_id
from Score
group by s_id
having count(c_id) = (select count(*) from Course)
```

------

**一些其他查询**



**46.把查询得到的数据插入另一个表中**

```sql
select proID,sum(buynum) as abuynum
into 新表
from orderitem group by proID
```

**47.查询ID字段重复的记录**

```sql
select * from people
where repeat_column in (
  select repeat_column 
 	from people 
 	group by repeat_column 
 	having count(repeat_column) > 1)
```

**48.请写出合适的SQL语句，查询出每种会员类型会员时长排名前三的用户，每种会员类型按剩余时长从大到小排序输出。（deadline字段说明：类型为datetime）。**

| 表名                                | 字段                                   |
| ----------------------------------- | -------------------------------------- |
| VIP_TYPE(id,name)                   | 会员编号，会员种类                     |
| VIP_USER(id,name,deadline,vip_type) | 会员编号，会员姓名，过期日期，会员类型 |

```sql
select vt.name, vu.name, vu.deadline
from VIP_USER vu INNER JOIN VIP_TYPE vt on vu.vip_type = vt.id
where(
	select count(distinct deadline) 
	from VIP_USER vp 
	where vp.vip_type = vu.vip_type and vp.deadline >= vu.deadline) < 3
order by vu.vip_type, vu.deadline desc, vu.id
```

**176.第二高的薪水:编写一个 SQL 查询，获取 `Employee` 表中第二高的薪水（Salary)**

```sql
select (select distinct Salary from Employee order by Salary desc limit 1,1) as 'SecondHighestSalary' 
```

**177.第二高的薪水:编写一个 SQL 查询，获取 `Employee` 表中第二高的薪水（Salary)**

```sql
CREATE FUNCTION getNthHighestSalary(N INT) RETURNS INT
BEGIN
    SET N:=N-1;
RETURN (
        select(
            select distinct Salary from Employee
            order by Salary desc
            limit N,1
        )
  );
END
```

**178. 分数排名**

窗口函数的区别:

- rank()

  排名为相同时记为同一个排名, 并且参与总排序

- dense_rank() over (PARTITION BY xx ORDER BY xx [DESC])

  排名相同时记为同一个排名, 并且不参与总排序

- row_number() over (over (PARTITION BY xx ORDER BY xx [DESC]))

  排名相同时记为下一个排名

```sql
select Score, dense_rank () over (order by Score desc) 'Rank'
from Scores
```

**180.连续出现的数字**

编写一个 SQL 查询，查找所有至少连续出现三次的数字。

返回的结果表中的数据可以按 **任意顺序** 排列。

```sql
SELECT DISTINCT
    l1.Num AS ConsecutiveNums
FROM
    Logs l1,
    Logs l2,
    Logs l3
WHERE
    l1.Id = l2.Id - 1
    AND l2.Id = l3.Id - 1
    AND l1.Num = l2.Num
    AND l2.Num = l3.Num
;
```

**181. 超过经理收入的员工**

```sql
SELECT
     a.NAME AS Employee
FROM Employee AS a JOIN Employee AS b
     ON a.ManagerId = b.Id
     AND a.Salary > b.Salary
```

**184. 部门工资最高的员工**

```sql
SELECT
    Department.name AS 'Department',
    Employee.name AS 'Employee',
    Salary
FROM
    Employee
        JOIN
    Department ON Employee.DepartmentId = Department.Id
WHERE
    (Employee.DepartmentId , Salary) IN
    (   SELECT
            DepartmentId, MAX(Salary)
        FROM
            Employee
        GROUP BY DepartmentId
	)
;
```

**185. 部门工资前三高的所有员工**

```sql
select d.Name 'Department', e1.Name 'Employee', e1.Salary 'Salary'
from Employee e1 join Department d on e1.DepartmentId = d.Id
where 3 >
(
    select count(distinct e2.Salary)
    from Employee e2 
    where e2.Salary > e1.Salary and e1.DepartmentId = e2.DepartmentId
)

```

**196. 删除重复的电子邮箱**

```sql
DELETE p1 FROM Person p1,
    Person p2
WHERE
    p1.Email = p2.Email AND p1.Id > p2.Id
```

**197. 上升的温度**

MySQL 使用 DATEDIFF 来比较两个日期类型的值。

因此，我们可以通过将 **weather** 与自身相结合，并使用 `DATEDIFF()` 函数。

```sql
select w1.id from 
Weather w1, Weather w2
where DATEDIFF(w1.recordDate,w2.recordDate) = 1 and w1.Temperature > w2.Temperature
```

**262. 行程和用户**

写一段 SQL 语句查出 "2013-10-01" 至 "2013-10-03" 期间非禁止用户（乘客和司机都必须未被禁止）的取消率。非禁止用户即 Banned 为 No 的用户，禁止用户即 Banned 为 Yes 的用户。

取消率 的计算方式如下：(被司机或乘客取消的非禁止用户生成的订单数量) / (非禁止用户生成的订单总数)。

返回结果表中的数据可以按任意顺序组织。其中取消率 Cancellation Rate 需要四舍五入保留 两位小数 。

```sql
select  
t.Request_at 'Day', 
round(avg(case when t.Status='completed' then 0.0 else 1.0 end ),2) 'Cancellation Rate'
from Trips t 
    join Users u1 on t.Client_Id = u1.Users_Id and u1.Banned = 'No'
    join Users u2 on t.Driver_Id = u2.Users_Id and u2.Banned = 'No'
where request_at between '2013-10-01' and '2013-10-03'
group by t.Request_at
order by t.Request_at asc
```

