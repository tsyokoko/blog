## 1.Maven基础知识

Maven是一个项目管理工具，它包含了一个项目对象模型 (Project Object Model)，一组标准集合，一个项目生命周期(Project Lifecycle)，一个依赖管理系统(Dependency Management System)，和用来运行定义在生命周期阶段(phase)中插件(plugin)目标(goal)的逻辑。

### 核心功能

- 依赖管理：Maven工程对jar包的管理过程。

一个复杂的项目将会包含很多依赖，也有可能包含依赖于其它构件的依赖。这是Maven最强大的特征之一，它支持了传递性依赖（transitive dependencies）。假如你的项目依赖于一个库，而这个库又依赖于五个或者十个其它的库（就像Spring或者Hibernate那样）。你不必找出所有这些依赖然后把它们写在你的pom.xml里，你只需要加上你直接依赖的那些库，Maven会隐式的把这些库间接依赖的库也加入到你的项目中。Maven也会处理这些依赖中的冲突，同时能让你自定义默认行为，或者排除一些特定的传递性依赖。

- 项目构建：`mvn tomcat:run`

### 仓库

本地仓库、远程仓库（私服）、中央仓库

本地仓库默认为{user.home}.m2.repority，可以在配置文件中修改

### Maven项目标准目录结构

核心代码部分：`src/main/java`

配置文件部分：`src/main/resources`

测试代码部分：`src/test/java`

测试配置文件：`src/test/resources`

页面资源（包含js，css，图片资源等）：`src/main/webapp`

### Maven常用命令

`clean`：删除项目中已经编译好的信息，删除target目录

`compile：Maven`工程的编译命令，用于编译项目的源代码，将`src/main/java`下的文件编译成class文件输出到target目录下。

`test`：使用合适的单元测试框架运行测试。

`package`：将编译好的代码打包成可分发的格式，如JAR，WAR。

`install`：安装包至本地仓库，以备本地的其它项目作为依赖使用。

`deploy`：复制最终的包至远程仓库，共享给其它开发人员和项目（通常和一次正式的发布相关）。

每一个构建项目的命令都对应了maven底层一个插件。

### Maven命令package、install、deploy的联系与区别

mvn clean package依次执行了clean、resources、compile、testResources、testCompile、test、jar(打包)等７个阶段。

mvn clean install依次执行了clean、resources、compile、testResources、testCompile、test、jar(打包)、install等8个阶段。

mvn clean deploy依次执行了clean、resources、compile、testResources、testCompile、test、jar(打包)、install、deploy等９个阶段。

主要区别：

package命令完成了项目编译、单元测试、打包功能，但没有把打好的可执行jar包（war包或其它形式的包）布署到本地maven仓库和远程maven私服仓库。

install命令完成了项目编译、单元测试、打包功能，同时把打好的可执行jar包（war包或其它形式的包）布署到本地maven仓库，但没有布署到远程maven私服仓库。

deploy命令完成了项目编译、单元测试、打包功能，同时把打好的可执行jar包（war包或其它形式的包）布署到本地maven仓库和远程maven私服仓库。　

### Maven生命周期

清理生命周期：运行mvn clean将调用清理生命周期 。

默认生命周期：是一个软件应用程序构建过程的总体模型 。

compile，test，package，install，deploy

站点生命周期：为一个或者一组项目生成项目文档和报告，使用较少。

### Maven概念模型

![Maven概念模型](https://tsyokoko-typora-images.oss-cn-shanghai.aliyuncs.com/img/1538609-20190521153807781-1976482426.png)

项目对象模型（Project Object Model，POM），对应着Maven项目中的pom.xml文件

项目自身信息

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
	<modelVersion>4.0.0</modelVersion>
	<parent>
		<groupId>org.springframework.boot</groupId>
		<artifactId>spring-boot-starter-parent</artifactId>
		<version>2.1.0.RELEASE</version>
		<relativePath/> <!-- lookup parent from repository -->
	</parent>
	<groupId>com.shangguan</groupId>
	<artifactId>concurrency</artifactId>
	<version>0.0.1-SNAPSHOT</version>
	<name>concurrency</name>
	<description>Demo project for Spring Boot</description>
```

项目运行所依赖的jar包信息，如：

```xml
	<dependencies>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-web</artifactId>
		</dependency>

		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-test</artifactId>
			<scope>test</scope>
		</dependency>
	</dependencies>
```

`<groupId>`：团体，公司，小组，组织，项目，或者其它团体。团体标识的约定是，它以创建这个项目的组织名称的逆向域名(reverse domain name)开头。

`<artifactId>`：项目的唯一标识符

`version`：项目的版本

`package`：项目的类型，默认是jar，描述了项目打包后的输出 。

项目运行环境信息，比如：jdk，tomcat信息

```xml
	<build>
		<plugins>
			<plugin>
				<groupId>org.springframework.boot</groupId>
				<artifactId>spring-boot-maven-plugin</artifactId>
			</plugin>
		</plugins>
	</build>
```

依赖范围

compile：默认的范围，编译测试运行都有效。

provided：编译和运行有效，最后在运行的时候不会加入。官方举了一个例子。比如在JavaEE web项目中我们需要使用servlet的API，但是Tomcat中已经提供这个jar，我们在编译和测试的时候需要使用这个api，但是部署到tomcat的时候，如果还加入servlet构建就会产生冲突，这个时候就可以使用provided。

runtime：测试和运行有效。

test：测试有效。

system：与本机系统关联，编译和测试时有效。

import：导入的范围，它只在使用dependencyManagement中，表示从其他pom中导入dependecy的配置。

### Maven依赖冲突

每个显式声明的类包都会依赖于一些其它的隐式类包，这些隐式的类包会被maven间接引入进来，因而可能造成一个我们不想要的类包的载入，严重的甚至会引起类包之间的冲突。

要解决这个问题，首先就是要查看pom.xml显式和隐式的依赖类包，然后通过这个类包树找出我们不想要的依赖类包，手工将其排除在外就可以了。 例如：

```xml
<exclusions>  
    <exclusion>  
        <artifactId>unitils-database</artifactId>  
        <groupId>org.unitils</groupId>  
    </exclusion>  
</exclusions>  
```